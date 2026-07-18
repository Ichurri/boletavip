import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { EventCardData } from "@/components/events/EventCard";

/** Shared shape for the home/catalog listings: enough of each zone to price
 * the event and compute how much of its inventory is left. */
export const eventCardInclude = {
  venue: {
    select: {
      name: true,
      city: true,
      zones: {
        select: {
          id: true,
          capacity: true,
          rows: true,
          priceMultiplier: true,
          seats: { select: { status: true } },
        },
      },
    },
  },
} satisfies Prisma.EventInclude;

type EventForCards = Prisma.EventGetPayload<{ include: typeof eventCardInclude }>;

const LOW_STOCK_RATIO = 0.1;

/** Tickets already committed per free-capacity zone (pending or confirmed orders). */
async function getFreeZoneSoldCounts(zoneIds: string[]) {
  if (zoneIds.length === 0) return new Map<string, number>();
  const grouped = await prisma.orderItem.groupBy({
    by: ["zoneId"],
    where: {
      zoneId: { in: zoneIds },
      seatId: null,
      order: {
        status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED"] },
      },
    },
    _sum: { quantity: true },
  });
  return new Map(
    grouped.map((row) => [row.zoneId as string, row._sum.quantity ?? 0]),
  );
}

export async function toEventCards(
  events: EventForCards[],
): Promise<EventCardData[]> {
  const freeZoneIds = [
    ...new Set(
      events.flatMap((event) =>
        event.venue.zones
          .filter((zone) => zone.rows === null)
          .map((zone) => zone.id),
      ),
    ),
  ];
  const soldByZone = await getFreeZoneSoldCounts(freeZoneIds);

  return events.map((event) => {
    const multipliers = event.venue.zones.map((zone) =>
      Number(zone.priceMultiplier),
    );

    let capacity = 0;
    let available = 0;
    for (const zone of event.venue.zones) {
      capacity += zone.capacity;
      available +=
        zone.rows === null
          ? Math.max(0, zone.capacity - (soldByZone.get(zone.id) ?? 0))
          : zone.seats.filter((seat) => seat.status === "AVAILABLE").length;
    }

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
      scarcity:
        capacity === 0
          ? undefined
          : available <= 0
            ? "soldout"
            : available / capacity < LOW_STOCK_RATIO
              ? "low"
              : undefined,
    };
  });
}
