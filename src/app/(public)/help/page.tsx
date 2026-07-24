import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Ayuda" };

const faqs = [
  {
    q: "¿Cómo compro un boleto?",
    a: "Elegí un evento, seleccioná tu zona o asiento y creá el pedido. Vas a ver el QR bancario del organizador: transferí el monto exacto desde la app de tu banco, sacale captura al comprobante y subilo en la página del pedido. Tenés 15 minutos para subir el comprobante antes de que el pedido expire.",
  },
  {
    q: "Ya pagué, ¿cuándo recibo mis boletos?",
    a: "El organizador revisa tu comprobante manualmente — le avisamos por correo apenas lo subís. La mayoría de los pagos se confirman en pocas horas. Cuando lo verifique, te llega un correo y tus boletos con QR aparecen en \"Mis pedidos\". No hace falta que te quedes esperando en la página.",
  },
  {
    q: "¿Qué pasa si el organizador rechaza mi comprobante?",
    a: "Te avisamos por correo con el motivo y los asientos se liberan. Si creés que es un error, contactá al organizador — su teléfono aparece en la página del evento y del pedido. Üticket no retiene tu dinero: el pago va directo a la cuenta del organizador, así que cualquier devolución la coordina él.",
  },
  {
    q: "¿Cómo entro al evento?",
    a: "Mostrá el QR de tu boleto en la puerta (desde la página del pedido, el PNG descargado o el PDF). Cada boleto se acepta una sola vez. Te recomendamos descargarlo antes por si no hay señal en el lugar.",
  },
  {
    q: "¿Puedo cancelar un pedido?",
    a: "Podés cancelar un pedido mientras esté esperando pago. Una vez que subiste el comprobante, la revisión queda en manos del organizador.",
  },
  {
    q: "Quiero vender entradas para mi evento",
    a: "Registrate como organizador (o pedí el cambio desde tu cuenta), creá tu venue y tu evento, y subí el QR de cobro de tu banco. Un administrador revisa el evento antes de publicarlo.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
          Ayuda
        </h1>
        <span className="mt-1.5 block h-[3px] w-10 bg-gradient-to-r from-gold to-transparent" />
        <p className="mt-2 text-muted-foreground">
          Las respuestas a lo que más nos preguntan.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {faqs.map((faq) => (
          <Card key={faq.q}>
            <CardContent className="p-5">
              <h2 className="font-semibold">{faq.q}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        ¿No encontraste tu respuesta? Revisá los{" "}
        <Link href="/terms" className="text-primary hover:underline">
          términos y condiciones
        </Link>{" "}
        o escribinos a soporte.
      </p>
    </div>
  );
}
