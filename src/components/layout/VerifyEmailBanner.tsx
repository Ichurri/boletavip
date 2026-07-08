import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResendVerificationButton } from "@/components/layout/ResendVerificationButton";

export async function VerifyEmailBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (!user || user.emailVerified) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      Verificá tu correo para poder comprar boletos — revisá tu bandeja de
      entrada. <ResendVerificationButton />
    </div>
  );
}
