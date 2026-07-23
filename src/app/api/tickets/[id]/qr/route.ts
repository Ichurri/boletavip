import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { dataUrlToBytes } from "@/lib/ticket-pdf";

type RouteContext = { params: Promise<{ id: string }> };

// Mobile browsers (notably iOS Safari) largely ignore the `download`
// attribute on <a href="data:..."> links and just navigate to/preview the
// image instead of saving it. Serving the PNG as a real HTTP response with
// Content-Disposition: attachment (same trick already used for the PDF
// route) makes the save-to-device prompt reliable across mobile browsers.
export async function GET(_request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      code: true,
      qrCode: true,
      order: { select: { buyerId: true } },
      event: { select: { organizerId: true } },
    },
  });
  if (
    !ticket ||
    !ticket.qrCode ||
    (ticket.order.buyerId !== session.user.id &&
      ticket.event.organizerId !== session.user.id &&
      session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Boleto no encontrado" }, { status: 404 });
  }

  const bytes = dataUrlToBytes(ticket.qrCode);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="boleto-${ticket.code.slice(0, 8)}.png"`,
    },
  });
}
