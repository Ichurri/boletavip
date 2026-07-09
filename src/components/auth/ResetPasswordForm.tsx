"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { resetPasswordSchema } from "@/lib/validations/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const confirm = formData.get("confirm");

    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Contraseña inválida");
      return;
    }
    if (password !== confirm) {
      setFieldError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setFormError(data?.error ?? "No se pudo restablecer la contraseña");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">✅</span>
        <p className="font-medium">¡Contraseña actualizada!</p>
        <p className="text-sm text-muted-foreground">
          Ya podés iniciar sesión con tu nueva contraseña.
        </p>
        <Link href="/login" className={buttonVariants({ size: "sm" })}>
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <FieldError message={fieldError ?? undefined} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Repetí la contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando..." : "Guardar nueva contraseña"}
      </Button>
      {formError && (
        <p className="text-center text-sm text-danger">
          {formError}{" "}
          <Link href="/forgot-password" className="underline">
            Pedir enlace nuevo
          </Link>
        </p>
      )}
    </form>
  );
}
