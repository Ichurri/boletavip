"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/* Plain calendar dates (no time-of-day, no timezone) — parsed/formatted
   from local Date components only, never through a timeZone-aware
   Intl formatter, so there's no risk of shifting a day at the UTC edge. */
function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const selected = parseDateValue(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const today = new Date();

  function selectDay(day: Date) {
    onChange(toDateValue(day));
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        onClick={() => {
          if (!open) setViewDate(selected ?? new Date());
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 text-left text-sm text-card-foreground transition-colors duration-200 hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        <span className={cn(!selected && "text-muted-foreground")}>
          {selected
            ? `${pad(selected.getDate())}/${pad(selected.getMonth() + 1)}/${selected.getFullYear()}`
            : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Elegir fecha"
          className="absolute z-50 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-card-hover"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 px-1 pb-1 text-center font-mono text-[11px] font-semibold text-muted-foreground">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 px-1">
            {days.map((day) => {
              const inMonth = day.getMonth() === month;
              const isSelected = selected !== null && isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              return (
                <div key={day.toISOString()} className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                      !inMonth && "text-muted-foreground/40 hover:bg-muted/60",
                      inMonth && !isSelected && "text-card-foreground hover:bg-muted",
                      isSelected &&
                        "bg-primary font-semibold text-primary-foreground shadow-glow-ring",
                      inMonth && !isSelected && isToday && "font-semibold text-primary",
                    )}
                  >
                    {day.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border-soft px-1 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => selectDay(today)}
              className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
