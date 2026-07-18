import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { eventDate } from "@/lib/utils";
import { eventCardInclude, toEventCards } from "@/lib/events";
import type { Prisma } from "@/generated/prisma/client";
import { EventCard } from "@/components/events/EventCard";
import {
  EventFilters,
  type EventFilterValues,
} from "@/components/events/EventFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Eventos",
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<EventFilterValues>;
}) {
  const filters = await searchParams;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const where: Prisma.EventWhereInput = {
    status: "APPROVED",
    date: { gte: filters.fecha ? eventDate(filters.fecha) : startOfToday },
    ...(filters.q?.trim()
      ? { title: { contains: filters.q.trim(), mode: "insensitive" } }
      : {}),
    ...(filters.categoria ? { category: filters.categoria } : {}),
    ...(filters.ciudad ? { venue: { city: filters.ciudad } } : {}),
    ...(filters.precio && Number(filters.precio) > 0
      ? { price: { lte: Number(filters.precio) } }
      : {}),
  };

  const [events, cityRows] = await Promise.all([
    prisma.event.findMany({
      where,
      include: eventCardInclude,
      orderBy: { date: "asc" },
    }),
    prisma.venue.findMany({
      where: { events: { some: { status: "APPROVED" } } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
  ]);

  const cards = await toEventCards(events);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold">Eventos</h1>
        <p className="mt-1 text-muted-foreground">
          Encontrá tu próximo plan y comprá tu boleto digital.
        </p>
      </div>

      <EventFilters cities={cityRows.map((row) => row.city)} current={filters} />

      {cards.length === 0 ? (
        <EmptyState
          icon={<SearchIcon />}
          title="No encontramos eventos"
          description="Probá con otros filtros o volvé pronto: siempre hay eventos nuevos."
          className="flex-1"
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {cards.length} evento{cards.length === 1 ? "" : "s"} encontrado
            {cards.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <EventCard key={card.id} event={card} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
