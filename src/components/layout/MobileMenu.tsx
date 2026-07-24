"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { buttonVariants } from "@/components/ui/Button";
import { MenuIcon, XIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface MobileMenuUser {
  name: string | null;
  email: string | null;
  role: "BUYER" | "ORGANIZER" | "ADMIN";
}

export function MobileMenu({ user }: { user: MobileMenuUser | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  function linkClass(href: string) {
    const active = pathname.startsWith(href);
    return cn(
      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  }
  const isOrganizer = user?.role === "ORGANIZER" || user?.role === "ADMIN";

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-muted"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? (
          <XIcon className="h-4 w-4" />
        ) : (
          <MenuIcon className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-16 z-50 border-b border-border bg-background shadow-lg">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
            <Link href="/events" className={linkClass("/events")} onClick={close}>
              Eventos
            </Link>
            {user && (
              <Link href="/orders" className={linkClass("/orders")} onClick={close}>
                Mis pedidos
              </Link>
            )}
            {isOrganizer && (
              <Link href="/dashboard" className={linkClass("/dashboard")} onClick={close}>
                Mi panel
              </Link>
            )}
            {user?.role === "ADMIN" && (
              <Link href="/admin" className={linkClass("/admin")} onClick={close}>
                Admin
              </Link>
            )}
            {user && (
              <Link href="/account" className={linkClass("/account")} onClick={close}>
                Mi cuenta
              </Link>
            )}

            <div className="my-2 h-px bg-border" />

            {user ? (
              <div className="flex items-center justify-between gap-2 px-3">
                <span className="truncate text-sm text-muted-foreground">
                  {user.name ?? user.email}
                </span>
                <button
                  type="button"
                  className="text-sm font-medium text-danger"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div className="flex gap-2 px-3">
                <Link
                  href="/login"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "flex-1",
                  })}
                  onClick={close}
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className={buttonVariants({ size: "sm", className: "flex-1" })}
                  onClick={close}
                >
                  Registrarse
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
