import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CalendarIcon, MapPinIcon, TicketIcon } from "@/components/ui/icons";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface EventCardData {
  id: string;
  title: string;
  category: string;
  date: Date;
  time: string;
  coverImage: string | null;
  venueName: string;
  city: string;
  priceFrom: number;
}

export function EventCard({ event }: { event: EventCardData }) {
  return (
    <Link href={`/events/${event.id}`} className="group">
      <Card className="h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-card-hover">
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-accent/20">
          {event.coverImage ? (
            <Image
              src={event.coverImage}
              alt={event.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <TicketIcon className="h-14 w-14 text-primary/40" />
            </div>
          )}
          <Badge variant="primary" className="absolute left-3 top-3 bg-card/90 backdrop-blur-sm">
            {event.category}
          </Badge>
        </div>

        <div className="flex flex-col gap-1.5 p-4">
          <h3 className="font-display font-semibold leading-snug transition-colors group-hover:text-primary">
            {event.title}
          </h3>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            {formatDate(event.date)} · {event.time} hrs
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            {event.venueName} · {event.city}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Desde{" "}
            <span className="text-base font-bold tabular-nums text-primary">
              {formatCurrency(event.priceFrom)}
            </span>
          </p>
        </div>
      </Card>
    </Link>
  );
}
