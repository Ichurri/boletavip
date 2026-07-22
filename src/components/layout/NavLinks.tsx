"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const linkClass = "relative text-sm font-medium transition-colors";
const activeClass =
  "text-primary after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-primary after:content-['']";
const inactiveClass = "text-muted-foreground hover:text-foreground";

export function NavLinks({
  isLoggedIn,
  isOrganizer,
  isAdmin,
  className,
}: {
  isLoggedIn: boolean;
  isOrganizer: boolean;
  isAdmin: boolean;
  className?: string;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/events", label: "Eventos", show: true },
    { href: "/orders", label: "Mis pedidos", show: isLoggedIn },
    { href: "/dashboard", label: "Mi panel", show: isOrganizer },
    { href: "/admin", label: "Admin", show: isAdmin },
  ].filter((link) => link.show);

  return (
    <div className={cn("hidden items-center gap-5 sm:flex", className)}>
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(linkClass, active ? activeClass : inactiveClass)}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
