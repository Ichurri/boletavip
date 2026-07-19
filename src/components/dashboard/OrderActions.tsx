"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CheckIcon, XIcon } from "@/components/ui/icons";

export function OrderActions({
  orderId,
  hasProof = false,
  compact = false,
}: {
  orderId: string;
  hasProof?: boolean;
  /** Icon-only 44px buttons for dense rows (dashboard home review queue). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function run(action: "confirm" | "cancel", body?: { reason?: string }) {
    setError(null);
    setNotice(null);
    setLoading(action);
    const response = await fetch(`/api/orders/${orderId}/${action}`, {
      method: "POST",
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    setLoading(null);

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "La acción falló");
      return;
    }
    if (data?.emailSent === false) {
      setNotice(
        "Listo, pero el correo al comprador falló — avisale por otro medio.",
      );
    }
    router.refresh();
  }

  function confirm() {
    const message = hasProof
      ? "¿Verificar el comprobante y confirmar el pago? Se generarán los boletos y se avisará al comprador por correo."
      : "¿Confirmar que recibiste el pago? Se generarán los boletos.";
    if (!window.confirm(message)) return;
    run("confirm");
  }

  function reject() {
    let reason = window.prompt(
      "Motivo del rechazo (obligatorio, se envía al comprador por correo):",
      "",
    );
    while (reason !== null && reason.trim() === "") {
      reason = window.prompt(
        "El motivo es obligatorio para rechazar un comprobante. Contá qué pasó:",
        "",
      );
    }
    if (reason === null) return; // user pressed cancel
    run("cancel", { reason: reason.trim() });
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <Button
            size="md"
            className="w-11 px-0"
            disabled={loading !== null}
            onClick={confirm}
            aria-label={hasProof ? "Verificar pago" : "Confirmar pago"}
            title={hasProof ? "Verificar pago" : "Confirmar pago"}
          >
            {loading === "confirm" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="md"
            className="w-11 px-0"
            disabled={loading !== null}
            onClick={reject}
            aria-label="Rechazar"
            title="Rechazar"
          >
            {loading === "cancel" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
        {error && (
          <p className="max-w-[160px] text-right text-xs text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p className="max-w-[160px] text-right text-xs text-warning">
            {notice}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" disabled={loading !== null} onClick={confirm}>
          {loading === "confirm"
            ? "Confirmando..."
            : hasProof
              ? "Verificar pago"
              : "Confirmar pago"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={reject}
        >
          {loading === "cancel" ? "Rechazando..." : "Rechazar"}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {notice && <p className="text-xs text-warning">{notice}</p>}
    </div>
  );
}
