"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Payment-proof viewer: a thumbnail that expands without opening a new tab.
 * - expand="inline" (default): the large image wraps onto its own full-width
 *   line — meant for flex-wrap card rows (organizer orders list).
 * - expand="overlay": the large image opens in a dismissable lightbox —
 *   meant for dense layouts like tables (buyers list).
 */
export function ProofImage({
  url,
  expand = "inline",
}: {
  url: string;
  expand?: "inline" | "overlay";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || expand !== "overlay") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, expand]);

  const isOverlay = expand === "overlay";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={open ? "Ocultar comprobante" : "Ver comprobante"}
        className="block shrink-0 cursor-pointer overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80"
      >
        <Image
          src={url}
          alt="Comprobante de pago"
          width={96}
          height={96}
          className={cn(
            "bg-white object-cover",
            isOverlay ? "h-12 w-12" : "h-20 w-20 sm:h-24 sm:w-24",
          )}
        />
      </button>

      {open && isOverlay && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Cerrar comprobante"
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <Image
            src={url}
            alt="Comprobante de pago ampliado"
            width={960}
            height={720}
            className="max-h-[85vh] w-auto max-w-full rounded-lg bg-white object-contain shadow-2xl"
          />
        </button>
      )}

      {open && !isOverlay && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Ocultar comprobante"
          className="order-last w-full cursor-zoom-out"
        >
          <Image
            src={url}
            alt="Comprobante de pago ampliado"
            width={960}
            height={720}
            className="max-h-[70vh] w-full rounded-md border border-border bg-white object-contain"
          />
        </button>
      )}
    </>
  );
}
