import { prisma } from "@/lib/prisma";

export const DEFAULT_ORDER_CUTOFF_HOURS = 2;

/** Platform-wide settings singleton; falls back to defaults if the row is missing. */
export async function getPlatformSettings() {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "main" },
  });
  return settings ?? { id: "main", orderCutoffHours: DEFAULT_ORDER_CUTOFF_HOURS };
}
