import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { changePasswordSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const { session, error } = await requireRole("BUYER", "ORGANIZER", "ADMIN");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  });
  if (!user?.password) {
    return NextResponse.json(
      { error: "Tu cuenta ingresa con Google y no tiene contraseña propia" },
      { status: 409 },
    );
  }

  const currentMatches = await bcrypt.compare(
    parsed.data.currentPassword,
    user.password,
  );
  if (!currentMatches) {
    return NextResponse.json(
      { error: "La contraseña actual no es correcta" },
      { status: 403 },
    );
  }

  const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return NextResponse.json({ ok: true });
}
