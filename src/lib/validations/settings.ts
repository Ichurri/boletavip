import { z } from "zod";

export const platformSettingsSchema = z.object({
  orderCutoffHours: z.coerce
    .number("Ingresá un número de horas")
    .int("Debe ser un número entero de horas")
    .min(0, "No puede ser negativo")
    .max(168, "Máximo una semana (168 horas)"),
});

export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;
