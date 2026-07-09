import type { Metadata } from "next";
import { TicketScanner } from "@/components/dashboard/TicketScanner";

export const metadata: Metadata = {
  title: "Verificar boletos",
};

export default function VerifyTicketsPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Verificar boletos</h1>
        <p className="mt-1 text-muted-foreground">
          Escaneá el QR de la entrada en la puerta del evento. Cada boleto se
          acepta una sola vez: al validarlo queda marcado como usado.
        </p>
      </div>
      <TicketScanner />
    </div>
  );
}
