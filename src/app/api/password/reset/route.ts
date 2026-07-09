import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { consumePasswordResetToken } from "@/lib/verification";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const email = await consumePasswordResetToken(parsed.data.token);
  if (!email) {
    return NextResponse.json(
      { error: "El enlace no es válido o expiró. Pedí uno nuevo." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "El enlace no es válido o expiró. Pedí uno nuevo." },
      { status: 400 },
    );
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      // Following the emailed link proves ownership of the address
      ...(user.emailVerified ? {} : { emailVerified: new Date() }),
    },
  });

  return NextResponse.json({ ok: true });
}
