import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailToken, type VerifyEmailResult } from "@/lib/verification";
import { buttonVariants } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Verificar correo",
};

type PageProps = { searchParams: Promise<{ token?: string }> };

const RESULT_COPY: Record<
  VerifyEmailResult,
  { emoji: string; title: string; detail: string }
> = {
  verified: {
    emoji: "✅",
    title: "¡Correo verificado!",
    detail: "Tu cuenta quedó lista. Ya podés comprar boletos para cualquier evento.",
  },
  "already-verified": {
    emoji: "👌",
    title: "Este correo ya estaba verificado",
    detail: "No tenés que hacer nada más. Podés seguir usando tu cuenta normalmente.",
  },
  invalid: {
    emoji: "⚠️",
    title: "El enlace no es válido o expiró",
    detail:
      "Los enlaces de verificación vencen a las 24 horas. Iniciá sesión y pedí un nuevo correo desde el aviso en la parte superior.",
  },
};

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const result: VerifyEmailResult = token
    ? await verifyEmailToken(token)
    : "invalid";
  const copy = RESULT_COPY[result];

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <span className="text-5xl">{copy.emoji}</span>
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.detail}</p>
      <Link href="/eventos" className={buttonVariants({ size: "sm" })}>
        Explorar eventos
      </Link>
    </div>
  );
}
