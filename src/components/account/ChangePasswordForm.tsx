"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CheckIcon } from "@/components/ui/icons";
import { changePasswordSchema } from "@/lib/validations/auth";

export function ChangePasswordForm() {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);
    setSaved(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    if (parsed.data.newPassword !== formData.get("confirm")) {
      setFieldError("Las contraseñas nuevas no coinciden");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/password/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setFormError(data?.error ?? "No se pudo cambiar la contraseña");
      return;
    }
    form.reset();
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Repetí la nueva contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
        />
        <FieldError message={fieldError ?? undefined} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading} className="self-start">
          {loading ? "Guardando..." : "Cambiar contraseña"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <CheckIcon className="h-4 w-4" />
            Contraseña actualizada
          </span>
        )}
      </div>
      {formError && <p className="text-sm text-danger">{formError}</p>}
    </form>
  );
}
