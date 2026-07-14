"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export function ProfileForm({ initialPhone }: { initialPhone: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar el teléfono");
      setStatus("idle");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-phone">Teléfono / WhatsApp</Label>
        <Input
          id="profile-phone"
          type="tel"
          placeholder="+591 70000000"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setStatus("idle");
          }}
        />
        <p className="text-xs text-muted-foreground">
          Incluí el código de país. Los compradores lo verán en tus eventos
          para consultas sobre pagos. Dejalo vacío para ocultarlo.
        </p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={status === "saving"}>
          {status === "saving"
            ? "Guardando..."
            : status === "saved"
              ? "Guardado ✓"
              : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
