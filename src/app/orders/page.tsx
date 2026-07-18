import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleOrders } from "@/lib/orders";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/generated/prisma/enums";
import { buttonVariants } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TicketIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Mis pedidos",
};

/** Pending first (needs the buyer's attention), then confirmed, then
 * cancelled last (dimmed, historical). */
const STATUS_RANK: Record<OrderStatus, number> = {
  PENDING_PAYMENT: 0,
  PAYMENT_SUBMITTED: 0,
  CONFIRMED: 1,
  CANCELLED: 2,
};

export default async function OrdersPage() {
  const session = await auth();
  await expireStaleOrders();

  const orders = await prisma.order.findMany({
    where: { buyerId: session!.user.id },
    include: {
      event: { select: { title: true, date: true, time: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  orders.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Mis pedidos</h1>

      {orders.length === 0 ? (
        <EmptyState
          icon={<TicketIcon />}
          title="Todavía no tenés pedidos"
          description="Cuando compres boletos, vas a poder seguir el estado de tus pedidos y descargar tus entradas desde acá."
          action={
            <Link href="/events" className={buttonVariants({ size: "sm" })}>
              Explorar eventos
            </Link>
          }
          className="flex-1 py-24"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const statusInfo = ORDER_STATUS_LABELS[order.status];
            const cancelled = order.status === "CANCELLED";
            return (
              <Card
                key={order.id}
                className={cancelled ? "opacity-[0.55]" : undefined}
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={
                          cancelled
                            ? "font-semibold line-through"
                            : "font-semibold"
                        }
                      >
                        {order.event.title}
                      </h2>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(order.event.date)} · {order.event.time} hrs ·{" "}
                      {formatCurrency(Number(order.totalAmount))}
                      {order._count.tickets > 0 &&
                        ` · ${order._count.tickets} boleto${order._count.tickets === 1 ? "" : "s"}`}
                    </p>
                    {cancelled && order.rejectionReason && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Motivo: {order.rejectionReason}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/orders/${order.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Ver pedido
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
