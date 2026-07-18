"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/* Fixed 15-minute PENDING_PAYMENT lifetime (src/lib/orders.ts) — the ring's
   fraction is normalized against this, not a prop, since it never varies. */
const TOTAL_SECONDS = 15 * 60;
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Counts down to the order expiry as a circular ring. Refreshes the page
 * when it hits zero (lazy expiration cancels the order server-side) and
 * every 15 s while waiting, so a manual confirmation by the organizer
 * shows up live.
 */
export function OrderCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const expiry = new Date(expiresAt).getTime();
    let ticks = 0;
    const id = setInterval(() => {
      const remaining = Math.max(0, expiry - Date.now());
      setRemainingMs(remaining);
      ticks += 1;
      if (remaining === 0) {
        clearInterval(id);
        router.refresh();
      } else if (ticks % 15 === 0) {
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, router]);

  const totalSeconds =
    remainingMs === null ? null : Math.floor(remainingMs / 1000);
  const display =
    totalSeconds === null
      ? "--:--"
      : `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
  const urgent = totalSeconds !== null && totalSeconds > 0 && totalSeconds < 120;
  const expired = totalSeconds === 0;

  const fraction = totalSeconds === null ? 1 : totalSeconds / TOTAL_SECONDS;
  const dashOffset = CIRCUMFERENCE * (1 - fraction);
  const minutesRemaining =
    totalSeconds === null ? null : Math.ceil(totalSeconds / 60);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            className="stroke-border"
          />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none",
              expired
                ? "stroke-border"
                : urgent
                  ? "stroke-danger"
                  : "stroke-gold dark:stroke-gold-bright",
            )}
          />
        </svg>
        <span
          className={cn(
            "absolute font-mono text-2xl font-bold tabular-nums",
            urgent && !expired ? "text-danger" : "text-foreground",
          )}
        >
          {display}
        </span>
      </div>

      <p className="max-w-[220px] text-center text-xs text-muted-foreground">
        {expired
          ? "Se acabó el tiempo, tu reserva se liberó."
          : urgent
            ? "Apurate, queda poco."
            : "Tu reserva está garantizada mientras corre el tiempo."}
      </p>

      {/* Throttled to once per minute change, not once per second. */}
      <span className="sr-only" aria-live="polite">
        {minutesRemaining === null
          ? ""
          : minutesRemaining <= 0
            ? "Se acabó el tiempo para pagar"
            : `Quedan ${minutesRemaining} minuto${minutesRemaining === 1 ? "" : "s"} para pagar`}
      </span>
    </div>
  );
}
