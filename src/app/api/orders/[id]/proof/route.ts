import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { expireStaleOrders } from "@/lib/orders";
import { proofSubmittedEmail, sendEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

// Proofs are bank receipts: stored privately (Vercel Blob private access in
// prod, a non-served local dir in dev) and streamed back only via the GET
// below. Legacy proofs predate this and were stored as public URLs.
//
// A Vercel Blob store's access mode (public/private) is fixed at store
// creation — it can't be mixed per-blob. The store used for public event
// images is Public, so proofs need a SEPARATE, dedicated Private store with
// its own token (BLOB_PROOFS_READ_WRITE_TOKEN), passed explicitly to put/get.
const PRIVATE_UPLOAD_DIR = path.join(process.cwd(), "private-uploads", "proofs");
const proofsBlobToken = process.env.BLOB_PROOFS_READ_WRITE_TOKEN;
const useBlobStorage = Boolean(proofsBlobToken);
// Deployed (some Blob token is set for the rest of the app) but the
// dedicated private store isn't configured yet: writing to local disk here
// would silently vanish (serverless filesystem), so fail loudly instead.
const blobConfiguredButNotPrivate =
  !useBlobStorage && Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const EXTENSION_CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_IMAGE_TYPES).map(([mime, ext]) => [ext, mime]),
);

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Buyer uploads the bank-transfer receipt for their own order. Moves the
 * order to PAYMENT_SUBMITTED, which stops the 15-minute expiry; the proof
 * can be replaced while the organizer hasn't reviewed it yet.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  await expireStaleOrders();

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      buyerId: true,
      status: true,
      totalAmount: true,
      buyer: { select: { name: true, email: true } },
      event: {
        select: {
          title: true,
          organizer: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!order || order.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_SUBMITTED") {
    return NextResponse.json(
      { error: "Este pedido ya no acepta comprobantes" },
      { status: 409 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se recibió ningún archivo" },
      { status: 400 },
    );
  }

  const extension = ALLOWED_IMAGE_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Formato no permitido. Usá JPG, PNG o WebP" },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "La imagen no puede superar los 5 MB" },
      { status: 400 },
    );
  }

  if (blobConfiguredButNotPrivate) {
    return NextResponse.json(
      {
        error:
          "El almacenamiento privado de comprobantes no está configurado en este entorno.",
      },
      { status: 500 },
    );
  }

  const fileName = `${randomUUID()}.${extension}`;
  const storedPath = `proofs/${fileName}`;
  if (useBlobStorage) {
    await put(storedPath, file, {
      access: "private",
      contentType: file.type,
      token: proofsBlobToken,
    });
  } else {
    await mkdir(PRIVATE_UPLOAD_DIR, { recursive: true });
    await writeFile(
      path.join(PRIVATE_UPLOAD_DIR, fileName),
      Buffer.from(await file.arrayBuffer()),
    );
  }

  // Guard on status again so an expiry/confirmation that raced us can't be overwritten
  const updated = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED"] },
    },
    data: {
      paymentProof: storedPath,
      paymentSubmittedAt: new Date(),
      status: "PAYMENT_SUBMITTED",
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Este pedido ya no acepta comprobantes" },
      { status: 409 },
    );
  }

  // Notify the organizer on the first submission only — replacements while
  // already in review would just spam their inbox.
  if (order.status === "PENDING_PAYMENT") {
    const origin = new URL(request.url).origin;
    const { subject, html } = proofSubmittedEmail(
      order.event.organizer.name,
      order.buyer.name ?? order.buyer.email,
      order.event.title,
      formatCurrency(Number(order.totalAmount)),
      `${origin}/dashboard/orders`,
    );
    await sendEmail({ to: order.event.organizer.email, subject, html });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Streams the proof image to the buyer, the event's organizer, or an admin. */
export async function GET(request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      paymentProof: true,
      buyerId: true,
      event: { select: { organizerId: true } },
    },
  });
  if (
    !order?.paymentProof ||
    (order.buyerId !== session.user.id &&
      order.event.organizerId !== session.user.id &&
      session.user.role !== "ADMIN")
  ) {
    return NextResponse.json(
      { error: "Comprobante no encontrado" },
      { status: 404 },
    );
  }

  // Legacy proofs were stored as public URLs/paths — just point at them
  if (
    order.paymentProof.startsWith("http") ||
    order.paymentProof.startsWith("/uploads/")
  ) {
    return NextResponse.redirect(new URL(order.paymentProof, request.url));
  }

  if (useBlobStorage) {
    const result = await get(order.paymentProof, {
      access: "private",
      token: proofsBlobToken,
    });
    if (!result) {
      return NextResponse.json(
        { error: "Comprobante no encontrado" },
        { status: 404 },
      );
    }
    const headers = new Headers(result.headers as HeadersInit);
    headers.set("Cache-Control", "private, no-store");
    return new Response(result.stream, { headers });
  }

  const fileName = path.basename(order.paymentProof);
  const extension = fileName.split(".").pop() ?? "jpg";
  const bytes = await readFile(path.join(PRIVATE_UPLOAD_DIR, fileName)).catch(
    () => null,
  );
  if (!bytes) {
    return NextResponse.json(
      { error: "Comprobante no encontrado" },
      { status: 404 },
    );
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": EXTENSION_CONTENT_TYPES[extension] ?? "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
