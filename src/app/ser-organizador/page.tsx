import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { QrCodeIcon, SparklesIcon, TicketIcon } from "@/components/ui/icons";
import { BecomeOrganizerForm } from "@/components/organizer/BecomeOrganizerForm";

export const metadata: Metadata = {
  title: "Quiero organizar eventos",
};

const perks = [
  {
    icon: SparklesIcon,
    title: "Creá tus eventos",
    description:
      "Cargá tus venues con mapa de asientos o zonas de cupo libre y publicá tus eventos tras la aprobación del equipo.",
  },
  {
    icon: QrCodeIcon,
    title: "Cobrá con tu QR",
    description:
      "Los compradores pagan directo a tu cuenta con tu QR bancario y suben el comprobante; vos lo verificás desde tu panel.",
  },
  {
    icon: TicketIcon,
    title: "Boletos con QR único",
    description:
      "Cada venta genera boletos digitales que validás en la puerta con el escáner integrado.",
  },
];

export default async function BecomeOrganizerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "BUYER") redirect("/dashboard/events/new");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Convertite en organizador</h1>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
          Publicá tus propios eventos en Üticket y gestioná las ventas desde tu
          panel. Tu cuenta de comprador se mantiene: también vas a poder seguir
          comprando entradas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {perks.map((perk) => (
          <Card key={perk.title}>
            <CardContent className="flex flex-col gap-2 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <perk.icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-semibold">{perk.title}</h3>
              <p className="text-xs text-muted-foreground">{perk.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activar mi cuenta de organizador</CardTitle>
        </CardHeader>
        <CardContent>
          <BecomeOrganizerForm />
        </CardContent>
      </Card>
    </div>
  );
}
