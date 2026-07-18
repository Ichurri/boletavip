"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { CheckIcon } from "@/components/ui/icons";

export function SettingsForm({ orderCutoffHours }: { orderCutoffHours: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("saving");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderCutoffHours: formData.get("orderCutoffHours"),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar la configuración");
      setStatus("idle");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="orderCutoffHours">
          Cierre de ventas (horas antes del evento)
        </Label>
        <Input
          id="orderCutoffHours"
          name="orderCutoffHours"
          type="number"
          min={0}
          max={168}
          step={1}
          defaultValue={orderCutoffHours}
          onChange={() => setStatus("idle")}
          className="max-w-32"
        />
        <p className="text-xs text-muted-foreground">
          Los compradores no podrán crear pedidos dentro de esta ventana. Con
          0, se puede comprar hasta la hora de inicio.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={status === "saving"}>
          {status === "saving" ? "Guardando..." : "Guardar"}
        </Button>
        {status === "saved" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <CheckIcon className="h-4 w-4" />
            Guardado
          </span>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
