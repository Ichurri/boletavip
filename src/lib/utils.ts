import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  minimumFractionDigits: 2,
});

export function formatCurrency(amount: number | string) {
  return currencyFormatter.format(Number(amount));
}

/** Short human-friendly order reference for the mono "ORD-XXXXXX" tag —
 * the id itself is a cuid, not meant to be read aloud in full. */
export function orderReference(id: string) {
  return id.slice(-6).toUpperCase();
}

/** Stored at noon UTC so the calendar date is stable in any nearby timezone. */
export function eventDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

/**
 * Real start instant of an event: calendar date (noon-UTC `date`) plus the
 * `time` string ("HH:MM") in Bolivia time (fixed UTC-4, no DST).
 */
export function eventStartsAt(event: { date: Date; time: string }) {
  const day = event.date.toISOString().slice(0, 10);
  return new Date(`${day}T${event.time}:00-04:00`);
}

/** Orders close `cutoffHours` before the event starts (platform setting). */
export function salesAreClosed(
  event: { date: Date; time: string },
  cutoffHours: number,
) {
  return Date.now() > eventStartsAt(event).getTime() - cutoffHours * 3_600_000;
}

/** All user-facing times are Bolivia time (fixed UTC-4) regardless of where
 * the server runs — Vercel renders in UTC, so formatters must pin this. */
export const BOLIVIA_TZ = "America/La_Paz";

const dateFormatter = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "long",
  timeZone: BOLIVIA_TZ,
});

export function formatDate(date: Date | string) {
  return dateFormatter.format(new Date(date));
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: BOLIVIA_TZ,
});

export function formatDateTime(date: Date | string) {
  return dateTimeFormatter.format(new Date(date));
}
