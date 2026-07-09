import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Restablecer contraseña",
};

type PageProps = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="text-4xl">⚠️</span>
          <p className="font-medium">Falta el enlace de restablecimiento</p>
          <p className="text-sm text-muted-foreground">
            Abrí el enlace desde el correo que te enviamos, o pedí uno nuevo.
          </p>
          <Link href="/forgot-password" className={buttonVariants({ size: "sm" })}>
            Pedir un enlace nuevo
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Creá tu nueva contraseña</CardTitle>
        <CardDescription>
          Elegí una contraseña de al menos 8 caracteres.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
