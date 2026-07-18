"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 2500;

/**
 * Full-screen door verdict (spec #7a): a solid color fill, a 148px icon in a
 * white ring, and the binary VÁLIDO/NO PASA word — the specific reason
 * (already used, cancelled, wrong event...) only shows in the pill below.
 * VÁLIDO auto-dismisses after 2.5s with a draining progress bar; anything
 * else waits for the door staff to press "Escanear otro".
 */
export function ScannerVerdict({
  accepted,
  reason,
  onDismiss,
}: {
  accepted: boolean;
  reason: string;
  onDismiss: () => void;
}) {
  const [draining, setDraining] = useState(false);

  useEffect(() => {
    if (!accepted) return;
    const startId = requestAnimationFrame(() => setDraining(true));
    const dismissId = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(startId);
      clearTimeout(dismissId);
    };
  }, [accepted, onDismiss]);

  return (
    <div
      role="alert"
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center",
        accepted ? "bg-success" : "bg-danger",
      )}
    >
      <div className="flex h-[148px] w-[148px] items-center justify-center rounded-full bg-white">
        {accepted ? (
          <CheckIcon className="h-20 w-20 text-success" strokeWidth={2.5} />
        ) : (
          <XIcon className="h-20 w-20 text-danger" strokeWidth={2.5} />
        )}
      </div>

      <p className="text-[46px] font-extrabold leading-none tracking-tight text-white">
        {accepted ? "VÁLIDO" : "NO PASA"}
      </p>

      <span className="max-w-full truncate rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white">
        {reason}
      </span>

      {accepted ? (
        <div className="mt-2 h-1 w-48 overflow-hidden rounded-full bg-white/25">
          <div
            className={cn(
              "h-full rounded-full bg-white ease-linear motion-reduce:transition-none",
              draining ? "w-0" : "w-full",
            )}
            style={{ transition: `width ${AUTO_DISMISS_MS}ms linear` }}
          />
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          className="mt-2 bg-white text-danger hover:bg-white/90"
          onClick={onDismiss}
        >
          Escanear otro
        </Button>
      )}
    </div>
  );
}
