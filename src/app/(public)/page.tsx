import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventCardInclude, toEventCards } from "@/lib/events";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/Card";
import {
  ArrowRightIcon,
  QrCodeIcon,
  SearchIcon,
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
    include: eventCardInclude,
    orderBy: { date: "asc" },
    take: 3,
  });

  return toEventCards(events);
}

export default async function HomePage() {
  const [featured, session] = await Promise.all([getFeaturedEvents(), auth()]);
  const role = session?.user?.role;
  const isOrganizer = role === "ORGANIZER" || role === "ADMIN";
  // Guests land on register (it offers the organizer option); buyers get the
  // upgrade form; organizers go straight to creating an event.
  const organizeHref = !session?.user
    ? "/register"
    : isOrganizer
      ? "/dashboard/events/new"
      : "/become-organizer";

  return (
    <>
      {/* Night-constant marquee hero — always the "Función Nocturna" surface,
          regardless of the site's light/dark theme (same forced-dark-scope
          trick as TicketCard/SeatMap's stage). */}
      <section
        className="dark relative isolate overflow-hidden border-b border-gold-bright/35 text-foreground"
        style={{ backgroundImage: "var(--ticket-surface)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 opacity-80"
          style={{ backgroundImage: "var(--spotlight)" }}
        />
        {/* Gold corner brackets, 44x3px, marquee-frame motif */}
        <span aria-hidden className="absolute left-6 top-6 h-11 w-11 border-l-[3px] border-t-[3px] border-gold-bright/70" />
        <span aria-hidden className="absolute right-6 top-6 h-11 w-11 border-r-[3px] border-t-[3px] border-gold-bright/70" />
        <span aria-hidden className="absolute bottom-6 left-6 h-11 w-11 border-b-[3px] border-l-[3px] border-gold-bright/70" />
        <span aria-hidden className="absolute bottom-6 right-6 h-11 w-11 border-b-[3px] border-r-[3px] border-gold-bright/70" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-24 text-center sm:py-32">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-gold-bright">
            Esta noche en Bolivia
          </span>
          <h1 className="max-w-3xl text-[34px] font-extrabold tracking-tight sm:text-[44px] lg:text-[56px]">
            Tu próxima{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              función
            </span>{" "}
            te espera
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Comedia, conciertos y teatro con entrada digital. Comprá en
            minutos, QR en tu bolsillo.
          </p>

          <form action="/events" className="w-full max-w-lg">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                type="search"
                name="q"
                placeholder="Buscá por artista, evento o ciudad"
                className="h-[52px] w-full rounded-full border border-white/15 bg-white/[0.06] pl-11 pr-4 text-sm text-white placeholder:text-white/50 backdrop-blur-md transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
              />
            </div>
          </form>

          <div className="flex w-full max-w-lg flex-wrap items-center justify-center gap-2">
            <Link
              href="/events"
              className="inline-flex h-9 items-center rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
            >
              Todos
            </Link>
            {EVENT_CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/events?categoria=${encodeURIComponent(category)}`}
                className="inline-flex h-9 items-center rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.12] hover:text-white"
              >
                {category}
              </Link>
            ))}
          </div>

          <Link
            href={organizeHref}
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-white/70 underline-offset-2 hover:text-white hover:underline"
          >
            {isOrganizer ? "Crear un evento" : "Quiero organizar un evento"}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Próximos eventos</h2>
            <Link
              href="/events"
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
