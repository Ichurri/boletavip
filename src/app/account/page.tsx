import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata: Metadata = {
  title: "Mi cuenta",
};

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Comprador",
  ORGANIZER: "Organizador",
  ADMIN: "Administrador",
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      phone: true,
      emailVerified: true,
      password: true,
      createdAt: true,
    },
  });
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="mt-1 text-muted-foreground">
          Tus datos y la seguridad de tu cuenta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la cuenta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium">{user.name ?? "—"}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Correo</span>
            <span className="flex items-center gap-2 font-medium">
              {user.email}
              {user.emailVerified ? (
                <Badge variant="success">Verificado</Badge>
              ) : (
                <Badge variant="warning">Sin verificar</Badge>
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Tipo de cuenta</span>
            <Badge variant="primary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
          </div>
        </CardContent>
      </Card>

      {user.role !== "BUYER" && (
        <Card>
          <CardHeader>
            <CardTitle>Contacto para compradores</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm initialPhone={user.phone} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {user.password ? (
            <ChangePasswordForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu cuenta ingresa con Google, así que no tiene una contraseña
              propia que cambiar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
