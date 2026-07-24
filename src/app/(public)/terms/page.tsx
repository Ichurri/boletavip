import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Términos y condiciones" };

const sections = [
  {
    title: "1. Qué es Üticket",
    body: "Üticket es una plataforma que conecta organizadores de eventos con compradores de boletos en Bolivia. Üticket no organiza los eventos ni procesa los pagos: el dinero se transfiere directamente del comprador a la cuenta bancaria del organizador mediante su QR de cobro.",
  },
  {
    title: "2. Pagos y confirmación",
    body: "Al crear un pedido, el comprador dispone de 15 minutos para subir el comprobante de la transferencia. El organizador verifica el comprobante manualmente y, al confirmarlo, se emiten los boletos con código QR. Üticket no retiene fondos ni garantiza la verificación en un plazo determinado.",
  },
  {
    title: "3. Rechazos y devoluciones",
    body: "Si el organizador rechaza un comprobante, los asientos se liberan y se notifica al comprador con el motivo. Cualquier devolución de dinero se coordina directamente con el organizador, cuyo contacto figura en la página del evento. Üticket puede mediar de buena fe pero no es responsable de las devoluciones.",
  },
  {
    title: "4. Boletos y entrada",
    body: "Cada boleto tiene un código QR único que se acepta una sola vez en la puerta. El comprador es responsable de no compartir su QR: la primera persona que lo presente será admitida.",
  },
  {
    title: "5. Eventos cancelados",
    body: "Si un evento se cancela, el organizador es responsable de la devolución del dinero a los compradores. Üticket marcará el evento como cancelado y facilitará el contacto entre las partes.",
  },
  {
    title: "6. Cuentas y conducta",
    body: "Está prohibido usar la plataforma para retener inventario sin intención de compra, subir comprobantes falsos o revender boletos de forma fraudulenta. Üticket puede suspender cuentas que incumplan estas condiciones.",
  },
  {
    title: "7. Cambios a estos términos",
    body: "Üticket puede actualizar estos términos; los cambios rigen desde su publicación en esta página.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
          Términos y condiciones
        </h1>
        <span className="mt-1.5 block h-[3px] w-10 bg-gradient-to-r from-gold to-transparent" />
        <p className="mt-2 text-muted-foreground">
          Última actualización: julio de 2026.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardContent className="p-5">
              <h2 className="font-semibold">{section.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {section.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
