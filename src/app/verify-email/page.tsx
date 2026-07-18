import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailToken, type VerifyEmailResult } from "@/lib/verification";
import { buttonVariants } from "@/components/ui/Button";
import { CheckIcon, AlertTriangleIcon } from "@/components/ui/icons";
import type { ComponentType } from "react";
import type { IconProps } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Verificar correo",
};

type PageProps = { searchParams: Promise<{ token?: string }> };

const VARIANT_CLASSES = {
  success: "bg-success/15 text-success",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
} as const;

const RESULT_COPY: Record<
  VerifyEmailResult,
  {
    icon: ComponentType<IconProps>;
    variant: keyof typeof VARIANT_CLASSES;
    title: string;
    detail: string;
  }
> = {
  verified: {
    icon: CheckIcon,
    variant: "success",
    title: "¡Correo verificado!",
    detail: "Tu cuenta quedó lista. Ya podés comprar boletos para cualquier evento.",
  },
  "already-verified": {
    icon: CheckIcon,
    variant: "primary",
    title: "Este correo ya estaba verificado",
    detail: "No tenés que hacer nada más. Podés seguir usando tu cuenta normalmente.",
  },
  invalid: {
    icon: AlertTriangleIcon,
    variant: "warning",
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
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full ${VARIANT_CLASSES[copy.variant]}`}
      >
        <copy.icon className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.detail}</p>
      <Link href="/events" className={buttonVariants({ size: "sm" })}>
        Explorar eventos
      </Link>
    </div>
  );
}
