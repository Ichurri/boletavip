import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { orderRejectedEmail, sendEmail } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { select: { seatId: true } },
      event: { select: { id: true, title: true, organizerId: true } },
      buyer: { select: { name: true, email: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const isBuyer = order.buyerId === session.user.id;
  const isOrganizer =
    order.event.organizerId === session.user.id ||
    session.user.role === "ADMIN";
  if (!isBuyer && !isOrganizer) {
    return NextResponse.json(
      { error: "No tenés permisos sobre este pedido" },
      { status: 403 },
    );
  }

  // Buyers may only abandon unpaid orders; once a proof is submitted the
  // review outcome belongs to the organizer (verify or reject).
  const cancellable: string[] = isOrganizer
    ? ["PENDING_PAYMENT", "PAYMENT_SUBMITTED"]
    : ["PENDING_PAYMENT"];
  if (!cancellable.includes(order.status)) {
    return NextResponse.json(
      { error: "Este pedido ya no se puede cancelar" },
      { status: 409 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const reason =
    isOrganizer && parsed.success && parsed.data.reason
      ? parsed.data.reason
      : null;

  const seatIds = order.items
    .map((item) => item.seatId)
    .filter((seatId): seatId is string => seatId !== null);

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", rejectionReason: reason },
    }),
    prisma.seat.updateMany({
      where: { id: { in: seatIds }, status: "RESERVED" },
      data: { status: "AVAILABLE" },
    }),
  ]);

  // Notify the buyer only when the organizer rejected a submitted proof
  let emailSent: boolean | null = null;
  if (isOrganizer && !isBuyer && order.status === "PAYMENT_SUBMITTED") {
    const origin = new URL(request.url).origin;
    const { subject, html } = orderRejectedEmail(
      order.buyer.name,
      order.event.title,
      reason,
      `${origin}/events/${order.event.id}`,
    );
    const emailResult = await sendEmail({ to: order.buyer.email, subject, html });
    emailSent = emailResult.ok;
    if (!emailResult.ok) {
      console.error(`[email] rejection email failed for order ${order.id}`);
    }
  }

  return NextResponse.json({ ok: true, emailSent });
}
