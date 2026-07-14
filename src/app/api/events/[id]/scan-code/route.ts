import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns the event's door-access code, creating it on first request.
 * Pass { rotate: true } to invalidate the previous link and issue a new one.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { session, error } = await requireRole("ORGANIZER", "ADMIN");
  if (error) return error;

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, status: true, organizerId: true, scanCode: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.organizerId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "No tenés permisos sobre este evento" },
      { status: 403 },
    );
  }
  if (event.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Solo los eventos aprobados tienen acceso de puerta" },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const rotate = Boolean((body as { rotate?: boolean } | null)?.rotate);

  if (event.scanCode && !rotate) {
    return NextResponse.json({ scanCode: event.scanCode });
  }
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { scanCode: randomUUID() },
    select: { scanCode: true },
  });
  return NextResponse.json({ scanCode: updated.scanCode });
}
