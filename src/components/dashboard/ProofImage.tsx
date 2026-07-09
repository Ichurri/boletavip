"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Payment-proof viewer for the organizer's orders list: a thumbnail that
 * expands in place (no new tab). Rendered inside a flex-wrap row — when
 * expanded, the w-full block wraps onto its own line below.
 */
export function ProofImage({ url }: { url: string }) {
  const [open, setOpen] = useState(false);

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
          className="h-20 w-20 bg-white object-cover sm:h-24 sm:w-24"
        />
      </button>
      {open && (
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
