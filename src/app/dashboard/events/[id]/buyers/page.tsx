import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleOrders } from "@/lib/orders";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { ProofImage } from "@/components/dashboard/ProofImage";

export const metadata: Metadata = {
  title: "Compradores",
};

export default async function EventBuyersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  await expireStaleOrders();

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, title: true, date: true, time: true, organizerId: true },
  });
  if (
    !event ||
    (event.organizerId !== session!.user.id && session!.user.role !== "ADMIN")
  ) {
    notFound();
  }

  // Everyone who holds or is buying tickets — cancelled orders excluded
  const orders = await prisma.order.findMany({
    where: {
      eventId: id,
      status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED"] },
    },
    include: {
      buyer: { select: { name: true, email: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const confirmed = orders.filter((order) => order.status === "CONFIRMED");
  const ticketsSold = confirmed.reduce(
    (sum, order) => sum + order._count.tickets,
    0,
  );
  const revenue = confirmed.reduce(
    (sum, order) => sum + Number(order.totalAmount),
    0,
  );
  const uniqueBuyers = new Set(orders.map((order) => order.buyer.email)).size;

  const stats = [
    { label: "Compradores", value: String(uniqueBuyers) },
    { label: "Boletos vendidos", value: String(ticketsSold) },
    { label: "Ingresos confirmados", value: formatCurrency(revenue) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compradores</h1>
          <p className="mt-1 text-muted-foreground">
            {event.title} · {formatDate(event.date)} · {event.time} hrs
          </p>
        </div>
        <Link
          href="/dashboard/events"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          ← Mis eventos
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <p className="truncate text-2xl font-bold" title={stat.value}>
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="text-4xl">🎟️</span>
            <p className="font-medium">Todavía no hay compradores</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Cuando alguien compre boletos para este evento, vas a ver acá su
              nombre y correo para poder contactarlo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Comprador</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Comprobante</th>
                <th className="px-4 py-3 text-right font-medium">Boletos</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const statusInfo = ORDER_STATUS_LABELS[order.status];
                return (
                  <tr
                    key={order.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      {order.buyer.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <a
                        href={`mailto:${order.buyer.email}`}
                        className="hover:text-primary hover:underline"
                      >
                        {order.buyer.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {order.paymentProof ? (
                        <ProofImage
                          url={`/api/orders/${order.id}/proof`}
                          expand="overlay"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {order.status === "CONFIRMED" ? order._count.tickets : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(Number(order.totalAmount))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
