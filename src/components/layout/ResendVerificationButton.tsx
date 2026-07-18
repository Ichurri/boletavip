"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui/icons";

export function ResendVerificationButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function resend() {
    setState("sending");
    const response = await fetch("/api/verify-email/resend", { method: "POST" });
    setState(response.ok ? "sent" : "error");
  }

  if (state === "sent")
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-success">
        <CheckIcon className="h-4 w-4" />
        Correo enviado
      </span>
    );

  return (
    <button
      type="button"
      onClick={resend}
      disabled={state === "sending"}
      className="cursor-pointer font-medium underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
    >
      {state === "sending"
        ? "Enviando..."
        : state === "error"
          ? "Falló, reintentar"
          : "Reenviar correo"}
    </button>
  );
}
