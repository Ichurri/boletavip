"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const parsed = forgotPasswordSchema.safeParse({
      email: formData.get("email"),
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Correo inválido");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setLoading(false);

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setFieldError(data?.error ?? "No se pudo procesar el pedido");
      return;
    }
    setMessage(data?.message ?? "Revisá tu correo.");
  }

  if (message) {
    return (
      <p className="rounded-md bg-primary-soft px-4 py-3 text-sm text-primary">
        📬 {message}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
        />
        <FieldError message={fieldError ?? undefined} />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviarme el enlace"}
      </Button>
    </form>
  );
}
