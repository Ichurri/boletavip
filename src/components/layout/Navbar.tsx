import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { CartButton } from "@/components/layout/CartButton";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { NavLinks } from "@/components/layout/NavLinks";
import { Logo } from "@/components/layout/Logo";

export async function Navbar() {
  const session = await auth();
  const user = session?.user;
  const isOrganizer = user?.role === "ORGANIZER" || user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4">
        <Link href="/" aria-label="Üticket — inicio">
          <Logo />
        </Link>

        <NavLinks
          isLoggedIn={Boolean(user)}
          isOrganizer={isOrganizer}
          isAdmin={user?.role === "ADMIN"}
          className="justify-self-center"
        />

        <div className="flex items-center gap-2 justify-self-end">
          <CartButton />
          <ThemeToggle />
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/account"
                title="Mi cuenta"
                className="hidden max-w-40 truncate text-sm text-muted-foreground transition-colors hover:text-foreground md:inline"
              >
                {user.name ?? user.email}
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Cerrar sesión
                </Button>
              </form>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                Registrarse
              </Link>
            </div>
          )}
          <MobileMenu
            user={
              user
                ? {
                    name: user.name ?? null,
                    email: user.email ?? null,
                    role: user.role,
                  }
                : null
            }
          />
        </div>
      </nav>
    </header>
  );
}
