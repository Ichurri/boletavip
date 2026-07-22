"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/events", label: "Eventos", exact: false },
  { href: "/admin/users", label: "Usuarios", exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function updateFades() {
      setShowLeftFade(el!.scrollLeft > 4);
      setShowRightFade(el!.scrollLeft + el!.clientWidth < el!.scrollWidth - 4);
    }
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);
    return () => {
      el.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, []);

  return (
    <div className="relative">
      <nav
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto scroll-smooth lg:flex-col lg:snap-none lg:overflow-visible"
      >
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "snap-start whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-200 lg:hidden",
          showLeftFade ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-200 lg:hidden",
          showRightFade ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
