import Link from "next/link";

const links = [
  { href: "/help", label: "Ayuda" },
  { href: "/terms", label: "Términos" },
  { href: "/privacy", label: "Privacidad" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Üticket. Todos los derechos reservados.</p>
        <nav className="flex items-center gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p>Boletos digitales para tus eventos favoritos 🇧🇴</p>
      </div>
    </footer>
  );
}
