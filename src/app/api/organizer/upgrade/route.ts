import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { unstable_update } from "@/lib/auth";

/**
 * Self-service role upgrade BUYER → ORGANIZER (same trust level as choosing
 * "quiero organizar eventos" at registration). Refreshes the JWT session so
 * the new role applies without re-login.
 */
export async function POST() {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  if (session.user.role !== "BUYER") {
    return NextResponse.json(
      { error: "Tu cuenta ya puede organizar eventos" },
      { status: 409 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: "ORGANIZER" },
  });

  // Triggers the jwt callback with trigger "update", which re-reads the role from DB
  await unstable_update({});

  return NextResponse.json({ ok: true });
}
