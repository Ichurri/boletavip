import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Carrito",
};

export default async function CartPage() {
  const session = await auth();
  const contact = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, phone: true },
      })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 lg:max-w-5xl">
      <CartView contact={contact} />
    </div>
  );
}
