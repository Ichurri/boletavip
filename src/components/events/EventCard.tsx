import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CalendarIcon, CategoryIcon, MapPinIcon, TicketIcon } from "@/components/ui/icons";
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
  /** Set when the event's remaining inventory is critically low or gone. */
  scarcity?: "low" | "soldout";
}

/* 14x14px gold corner brackets over the poster, echoing the marquee frame. */
function PosterCorners() {
  return (
    <>
      <span aria-hidden className="absolute left-2 top-2 h-3.5 w-3.5 rounded-tl-sm border-l-2 border-t-2 border-gold-bright opacity-75 transition-opacity duration-200 group-hover:opacity-100" />
      <span aria-hidden className="absolute right-2 top-2 h-3.5 w-3.5 rounded-tr-sm border-r-2 border-t-2 border-gold-bright opacity-75 transition-opacity duration-200 group-hover:opacity-100" />
      <span aria-hidden className="absolute bottom-2 left-2 h-3.5 w-3.5 rounded-bl-sm border-b-2 border-l-2 border-gold-bright opacity-75 transition-opacity duration-200 group-hover:opacity-100" />
      <span aria-hidden className="absolute bottom-2 right-2 h-3.5 w-3.5 rounded-br-sm border-b-2 border-r-2 border-gold-bright opacity-75 transition-opacity duration-200 group-hover:opacity-100" />
    </>
  );
}

export function EventCard({ event }: { event: EventCardData }) {
  return (
    <Link href={`/events/${event.id}`} className="group">
      <Card className="h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-[3px] group-hover:border-primary/30 group-hover:shadow-card-hover">
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-accent/20">
          {event.coverImage ? (
            <>
              {/* Blurred cover of the same image fills the letterbox area */}
              <Image
                src={event.coverImage}
                alt=""
                aria-hidden
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="scale-110 object-cover opacity-60 blur-lg"
              />
              <Image
                src={event.coverImage}
                alt={event.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <TicketIcon className="h-14 w-14 text-primary/40" />
            </div>
          )}
          <PosterCorners />
          {/* Diagonal ribbon tag, cut with clip-path like a flag hanging off the corner.
              Fixed dark plaque (doesn't invert with theme) — same night-constant
              treatment as the ticket/marquee accents. */}
          <div
            className="absolute left-0 top-0 flex items-center gap-1.5 bg-[#171128] py-1.5 pl-3 pr-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#e9ce8b] backdrop-blur-sm"
            style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
          >
            <CategoryIcon category={event.category} className="h-3.5 w-3.5 shrink-0" />
            {event.category}
          </div>
          {event.scarcity && (
            <span
              className={
                event.scarcity === "soldout"
                  ? "absolute bottom-2 right-2 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur-sm"
                  : "absolute bottom-2 right-2 rounded-full bg-danger/15 px-2.5 py-1 text-[11px] font-semibold text-danger backdrop-blur-sm"
              }
            >
              {event.scarcity === "soldout" ? "Agotado" : "¡Últimos lugares!"}
            </span>
          )}
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
            <span className="text-base font-extrabold tabular-nums text-primary">
              {formatCurrency(event.priceFrom)}
            </span>
          </p>
        </div>
      </Card>
    </Link>
  );
}
