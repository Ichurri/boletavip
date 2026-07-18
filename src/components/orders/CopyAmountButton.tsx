"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CopyIcon, CheckIcon } from "@/components/ui/icons";

/* Copy-to-clipboard affordance for the exact transfer amount (spec #4c/#4d:
   "botón Copiar" next to the bank data — this app's payment data is a QR
   image with no textual bank fields, so the amount is the one real value
   worth copying into a banking app). */
export function CopyAmountButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar monto ${value}`}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        copied
          ? "border-success/40 bg-success/10 text-success"
          : "border-border text-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary",
      )}
    >
      {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
      {copied ? "¡Copiado!" : "Copiar"}
    </button>
  );
}
