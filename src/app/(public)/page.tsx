import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  ArrowRightIcon,
  QrCodeIcon,
  SparklesIcon,
  TicketIcon,
} from "@/components/ui/icons";
import { EventCard, type EventCardData } from "@/components/events/EventCard";

const features = [
  {
    icon: SparklesIcon,
    title: "Eventos únicos",
    description:
      "Shows de comedia, conciertos y experiencias en vivo, todo en un solo lugar.",
  },
  {
    icon: QrCodeIcon,
    title: "Pago con QR",
    description:
      "Paga con una transferencia QR desde tu banco y confirma tu compra sin complicaciones.",
  },
  {
    icon: TicketIcon,
    title: "Boleto digital",
    description:
      "Recibe tu entrada con código QR único, lista para mostrar desde tu celular.",
  },
];

async function getFeaturedEvents(): Promise<EventCardData[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const events = await prisma.event.findMany({
    where: { status: "APPROVED", date: { gte: startOfToday } },
    include: {
      venue: {
        select: {
          name: true,
          city: true,
          zones: { select: { priceMultiplier: true } },
        },
      },
    },
    orderBy: { date: "asc" },
    take: 3,
  });

  return events.map((event) => {
    const multipliers = event.venue.zones.map((zone) =>
      Number(zone.priceMultiplier),
    );
    return {
      id: event.id,
      title: event.title,
      category: event.category,
      date: event.date,
      time: event.time,
      coverImage: event.coverImage,
      venueName: event.venue.name,
      city: event.venue.city,
      priceFrom:
        Number(event.price) * (multipliers.length ? Math.min(...multipliers) : 1),
    };
  });
}

export default async function HomePage() {
  const featured = await getFeaturedEvents();

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-[80%] rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 left-1/2 h-64 w-64 translate-x-[10%] rounded-full bg-accent/15 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center sm:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-card">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            La boletería digital de Bolivia
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Tu entrada en{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              un clic
            </span>
            .
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Conectamos personas con experiencias mediante boletos digitales
            rápidos, seguros y simples.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/eventos" className={buttonVariants({ size: "lg" })}>
              Explorar eventos
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Quiero organizar un evento
            </Link>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Próximos eventos</h2>
            <Link
              href="/eventos"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver todos
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover"
            >
              <CardContent className="flex flex-col gap-3 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
