"use client";

import { useState } from "react";

export function ResendVerificationButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function resend() {
    setState("sending");
    const response = await fetch("/api/verify-email/resend", { method: "POST" });
    setState(response.ok ? "sent" : "error");
  }

  if (state === "sent") return <span className="font-medium">Correo enviado ✓</span>;

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
