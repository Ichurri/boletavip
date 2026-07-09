"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function BecomeOrganizerForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function upgrade() {
    setError(null);
    setLoading(true);
    const response = await fetch("/api/organizer/upgrade", { method: "POST" });

    if (!response.ok) {
      setLoading(false);
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo activar tu cuenta de organizador");
      return;
    }
    // Full navigation so the refreshed session cookie (new role) is applied
    // before the proxy checks access to /dashboard
    window.location.href = "/dashboard/events/new";
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Al confirmar, tu cuenta pasa a ser de organizador y se abre tu panel
        para crear el primer evento. Los eventos se publican después de una
        revisión del equipo de Üticket.
      </p>
      <Button type="button" onClick={upgrade} disabled={loading} className="self-start">
        {loading ? "Activando..." : "Quiero organizar eventos"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
