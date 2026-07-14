"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Fetches (or rotates) the event's door-access link and offers copy/share. */
export function ScanAccessButton({ eventId }: { eventId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCode(rotate = false) {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/events/${eventId}/scan-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotate }),
    });
    setLoading(false);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.scanCode) {
      setError(data?.error ?? "No se pudo generar el acceso");
      return;
    }
    setLink(`${window.location.origin}/scan/${data.scanCode}`);
    setCopied(false);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  if (!link) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => fetchCode()}
        >
          {loading ? "Generando..." : "Acceso para puerta"}
        </Button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
          {link}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? "¡Copiado!" : "Copiar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => fetchCode(true)}
        >
          {loading ? "..." : "Regenerar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Compartí este enlace con tu personal de puerta: les abre el escáner de
        este evento sin necesidad de cuenta. Si se filtra, regeneralo.
      </p>
    </div>
  );
}
