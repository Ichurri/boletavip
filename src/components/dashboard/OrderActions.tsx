"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function OrderActions({
  orderId,
  hasProof = false,
}: {
  orderId: string;
  hasProof?: boolean;
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
    const reason = window.prompt(
      hasProof
        ? "Motivo del rechazo (se envía al comprador por correo, opcional):"
        : "Motivo del rechazo (opcional):",
      "",
    );
    if (reason === null) return; // user pressed cancel
    run("cancel", { reason: reason.trim() || undefined });
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
      {notice && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{notice}</p>
      )}
    </div>
  );
}
