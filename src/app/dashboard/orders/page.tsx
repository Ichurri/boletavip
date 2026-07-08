import type { Metadata } from "next";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleOrders } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { OrderActions } from "@/components/dashboard/OrderActions";

export const metadata: Metadata = {
  title: "Pedidos",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "short",
  timeStyle: "short",
});

function itemsSummary(
  items: {
    quantity: number;
    seat: { row: string; number: number } | null;
    zone: { name: string } | null;
  }[],
) {
  return items
    .map((item) =>
      item.seat
        ? `${item.zone?.name ?? ""} ${item.seat.row}${item.seat.number}`
        : `${item.zone?.name ?? "Zona"} × ${item.quantity}`,
    )
    .join(", ");
}

export default async function DashboardOrdersPage() {
  const session = await auth();
  await expireStaleOrders();

  const orders = await prisma.order.findMany({
    where: { event: { organizerId: session!.user.id } },
    include: {
      buyer: { select: { name: true, email: true } },
      event: { select: { title: true } },
      items: {
        include: {
          seat: { select: { row: true, number: true } },
          zone: { select: { name: true } },
        },
      },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const inReview = orders.filter(
    (order) => order.status === "PAYMENT_SUBMITTED",
  );
  const pending = orders.filter((order) => order.status === "PENDING_PAYMENT");
  const history = orders.filter(
    (order) =>
      order.status !== "PENDING_PAYMENT" &&
      order.status !== "PAYMENT_SUBMITTED",
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="mt-1 text-muted-foreground">
          Revisá los comprobantes de pago para emitir los boletos.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">
          Comprobantes por revisar ({inReview.length})
        </h2>
        {inReview.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No hay comprobantes esperando revisión. Cuando un comprador suba
              su comprobante de pago, aparecerá acá hasta que lo verifiques o
              rechaces.
            </CardContent>
          </Card>
        ) : (
          inReview.map((order) => (
            <Card key={order.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex min-w-0 flex-wrap items-center gap-4">
                  {order.paymentProof && (
                    <a
                      href={order.paymentProof}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver comprobante completo"
                      className="block shrink-0 overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80"
                    >
                      <Image
                        src={order.paymentProof}
                        alt="Comprobante de pago"
                        width={96}
                        height={96}
                        className="h-24 w-24 bg-white object-cover"
                      />
                    </a>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {order.buyer.name ?? order.buyer.email} ·{" "}
                      {formatCurrency(Number(order.totalAmount))}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.event.title} · {itemsSummary(order.items)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Comprobante subido{" "}
                      {order.paymentSubmittedAt
                        ? dateTimeFormatter.format(order.paymentSubmittedAt)
                        : "—"}
                    </p>
                  </div>
                </div>
                <OrderActions orderId={order.id} hasProof />
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">
          Pendientes de pago ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No hay pedidos esperando pago. Cuando un comprador cree un
              pedido, aparecerá acá durante 15 minutos hasta que suba su
              comprobante.
            </CardContent>
          </Card>
        ) : (
          pending.map((order) => (
            <Card key={order.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {order.buyer.name ?? order.buyer.email} ·{" "}
                    {formatCurrency(Number(order.totalAmount))}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.event.title} · {itemsSummary(order.items)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Creado {dateTimeFormatter.format(order.createdAt)} · expira{" "}
                    {dateTimeFormatter.format(order.expiresAt)}
                  </p>
                </div>
                <OrderActions orderId={order.id} />
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">Historial ({history.length})</h2>
        {history.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Los pedidos confirmados o cancelados aparecerán acá.
            </CardContent>
          </Card>
        ) : (
          history.map((order) => {
            const statusInfo = ORDER_STATUS_LABELS[order.status];
            return (
              <Card key={order.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {order.buyer.name ?? order.buyer.email} ·{" "}
                        {formatCurrency(Number(order.totalAmount))}
                      </p>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.event.title} · {itemsSummary(order.items)}
                      {order._count.tickets > 0 &&
                        ` · ${order._count.tickets} boleto${order._count.tickets === 1 ? "" : "s"} emitido${order._count.tickets === 1 ? "" : "s"}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Creado {dateTimeFormatter.format(order.createdAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
