import { z } from "zod";

export const verifyTicketSchema = z.object({
  code: z.uuid("Código de boleto inválido"),
  scanCode: z.uuid().optional(),
});

export type VerifyTicketInput = z.input<typeof verifyTicketSchema>;
