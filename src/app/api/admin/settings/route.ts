import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { platformSettingsSchema } from "@/lib/validations/settings";

export async function PATCH(request: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = platformSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const settings = await prisma.platformSettings.upsert({
    where: { id: "main" },
    update: { orderCutoffHours: parsed.data.orderCutoffHours },
    create: { id: "main", orderCutoffHours: parsed.data.orderCutoffHours },
  });

  return NextResponse.json({ settings });
}
