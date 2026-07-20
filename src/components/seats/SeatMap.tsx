"use client";

import { NumberedZoneGrid } from "@/components/seats/NumberedZoneGrid";
import { FreeZoneSelector } from "@/components/seats/FreeZoneSelector";
import type { EventSeatMapDto } from "@/types/seat-map";

const legend = [
  { label: "Disponible", className: "border border-border bg-card" },
  { label: "Seleccionado", className: "bg-primary shadow-glow-ring" },
  { label: "Reservado", className: "bg-accent/30" },
  { label: "Vendido", className: "bg-muted" },
];

/* Alternating gold/cream marquee bulbs framing the stage label — always
   on the night-constant stage surface, so fixed hex is intentional here
   (same reasoning as the ticket's forced-dark surface). */
const MARQUEE_LIGHTS = 11;

export function SeatMap({ seatMap }: { seatMap: EventSeatMapDto }) {
  const numberedZones = seatMap.zones.filter((zone) => zone.numbered);
  const freeZones = seatMap.zones.filter((zone) => !zone.numbered);

  return (
    <div className="flex flex-col gap-6">
      {numberedZones.length > 0 && (
        <>
          <div
            aria-hidden="true"
            className="relative overflow-hidden rounded-b-[150px] px-6 pb-4 pt-3 text-center shadow-[0_14px_36px_-8px_rgb(109_43_255/0.5)]"
            style={{ backgroundImage: "linear-gradient(180deg, #2a1852, #171128)" }}
          >
            <div
              className="animate-stage-spotlight pointer-events-none absolute inset-x-0 -top-10 mx-auto h-32 w-56 opacity-85"
              style={{ backgroundImage: "var(--spotlight)" }}
            />
            <div className="relative">
              <div className="mb-2 flex items-center justify-center gap-2">
                {Array.from({ length: MARQUEE_LIGHTS }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: i % 2 === 0 ? "#e9ce8b" : "#f5ece0" }}
                  />
                ))}
              </div>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.34em] text-[#cda349]">
                Escenario
              </span>
            </div>
            <div className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-[rgb(205_163_73/0.55)]" />
          </div>

          {numberedZones.map((zone) => (
            <NumberedZoneGrid
              key={zone.id}
              eventId={seatMap.eventId}
              eventTitle={seatMap.eventTitle}
              zone={zone}
            />
          ))}

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {legend.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={`h-3.5 w-3.5 rounded ${item.className}`} />
                {item.label}
              </span>
            ))}
          </div>
        </>
      )}

      {freeZones.length > 0 && (
        <div className="flex flex-col gap-3">
          {numberedZones.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground">
              Zonas de capacidad libre
            </h3>
          )}
          {freeZones.map((zone) => (
            <FreeZoneSelector
              key={zone.id}
              eventId={seatMap.eventId}
              eventTitle={seatMap.eventTitle}
              zone={zone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
