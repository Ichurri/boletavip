import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { expireStaleOrders } from "@/lib/orders";
import { getPlatformSettings } from "@/lib/settings";
import { formatCurrency } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { HourglassIcon } from "@/components/ui/icons";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = {
  title: "Administración",
};

export default async function AdminPage() {
  await expireStaleOrders();
  const settings = await getPlatformSettings();

  const [
    userCount,
    organizerCount,
    suspendedCount,
    eventCount,
    pendingEvents,
    approvedEvents,
    salesAggregate,
    ticketCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ORGANIZER" } }),
    prisma.user.count({ where: { suspended: true } }),
    prisma.event.count(),
    prisma.event.count({ where: { status: "PENDING" } }),
    prisma.event.count({ where: { status: "APPROVED" } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: "CONFIRMED" },
    }),
    prisma.ticket.count({ where: { status: { not: "CANCELLED" } } }),
  ]);

  const stats = [
    {
      label: "Ventas confirmadas",
      value: formatCurrency(Number(salesAggregate._sum.totalAmount ?? 0)),
    },
    { label: "Boletos emitidos", value: String(ticketCount) },
    { label: "Usuarios registrados", value: String(userCount) },
    { label: "Organizadores", value: String(organizerCount) },
    { label: "Eventos totales", value: String(eventCount) },
    { label: "Eventos aprobados", value: String(approvedEvents) },
    { label: "Eventos por revisar", value: String(pendingEvents) },
    { label: "Cuentas suspendidas", value: String(suspendedCount) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
          Panel de administración
        </h1>
        <span className="mt-1.5 block h-[3px] w-10 bg-gradient-to-r from-gold to-transparent" />
        <p className="mt-2 text-muted-foreground">
          Métricas globales de la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {pendingEvents > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold-soft px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <HourglassIcon className="h-4 w-4 shrink-0 text-gold" />
            <p className="text-sm">
              <span className="font-bold text-gold">
                {pendingEvents} evento{pendingEvents === 1 ? "" : "s"} esperando
                revisión
              </span>{" "}
              <span className="text-muted-foreground">
                — los organizadores no pueden vender hasta que los apruebes.
              </span>
            </p>
          </div>
          <Link href="/admin/events" className={buttonVariants({ size: "sm" })}>
            Revisar eventos
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configuración de la plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm orderCutoffHours={settings.orderCutoffHours} />
        </CardContent>
      </Card>
    </div>
  );
}
