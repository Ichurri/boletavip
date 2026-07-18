import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EVENT_STATUS_LABELS } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MicIcon, TicketIcon } from "@/components/ui/icons";
import { EventActions } from "@/components/dashboard/EventActions";

export const metadata: Metadata = {
  title: "Mis eventos",
};

export default async function DashboardEventsPage() {
  const session = await auth();

  const events = await prisma.event.findMany({
    where: { organizerId: session!.user.id },
    include: {
      venue: { select: { name: true, city: true, capacity: true } },
      _count: { select: { tickets: { where: { status: { not: "CANCELLED" } } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis eventos</h1>
        <Link href="/dashboard/events/new" className={buttonVariants({ size: "sm" })}>
          + Nuevo evento
        </Link>
      </div>

      {events.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MicIcon />}
            title="Todavía no tenés eventos"
            description="Creá tu primer evento, subí el QR de pago y envialo a revisión para que aparezca en el catálogo."
            action={
              <Link
                href="/dashboard/events/new"
                className={buttonVariants({ size: "sm" })}
              >
                Crear mi primer evento
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => {
            const statusInfo = EVENT_STATUS_LABELS[event.status];
            const editable =
              event.status === "DRAFT" || event.status === "PENDING";
            const capacity = event.venue.capacity;
            const sold = event._count.tickets;
            const percent =
              capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
            return (
              <Card key={event.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {event.coverImage ? (
                        <Image
                          src={event.coverImage}
                          alt=""
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <TicketIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{event.title}</h2>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(event.date)} · {event.time} hrs ·{" "}
                        {event.venue.name} ({event.venue.city}) · Desde{" "}
                        {formatCurrency(Number(event.price))}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {sold}/{capacity} boletos
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {event.status === "APPROVED" && (
                      <Link
                        href={`/events/${event.id}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        Ver pública
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/events/${event.id}/buyers`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Compradores
                    </Link>
                    {editable && (
                      <Link
                        href={`/dashboard/events/${event.id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Editar
                      </Link>
                    )}
                    <EventActions eventId={event.id} status={event.status} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
