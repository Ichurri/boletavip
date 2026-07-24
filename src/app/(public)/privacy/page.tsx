import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Privacidad" };

const sections = [
  {
    title: "Qué datos guardamos",
    body: "Tu nombre, correo y (si sos organizador) tu teléfono de contacto; los pedidos y boletos que generás; y los comprobantes de pago que subís. Los comprobantes se almacenan de forma privada y solo pueden verlos vos, el organizador del evento y los administradores de la plataforma.",
  },
  {
    title: "Para qué los usamos",
    body: "Para emitir y validar tus boletos, para que el organizador pueda verificar tu pago y contactarte si hace falta, y para enviarte correos transaccionales (verificación de cuenta, confirmación o rechazo de pedidos). No enviamos publicidad ni compartimos tus datos con terceros ajenos a la operación del servicio.",
  },
  {
    title: "Dónde se almacenan",
    body: "Los datos viven en proveedores de infraestructura en la nube (base de datos y almacenamiento de archivos) contratados por Üticket. Las contraseñas se guardan cifradas con hash; nunca en texto plano.",
  },
  {
    title: "Tus derechos",
    body: "Podés pedir la corrección o eliminación de tus datos escribiéndonos. Ten en cuenta que los registros de pedidos confirmados pueden conservarse por obligaciones contables del organizador.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
          Política de privacidad
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
