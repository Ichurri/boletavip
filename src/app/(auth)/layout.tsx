import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-1">
      {/* Desktop-only brand panel (spec #9c) — always the night-constant
          surface, same trick as the ticket/hero/scanner, and kept in sync
          with the home hero's copy (spec #5c). Mobile just keeps the
          global Navbar's logo, so nothing is added there. */}
      <div
        className="dark relative hidden w-1/2 overflow-hidden border-r border-gold-bright/30 text-foreground lg:flex lg:items-center"
        style={{ backgroundImage: "var(--ticket-surface)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-[15%] h-[420px] w-[420px] opacity-80"
          style={{ backgroundImage: "var(--spotlight)" }}
        />
        <div className="relative flex flex-col gap-4 px-16">
          <Logo className="h-8 w-auto" />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-gold-bright">
            Esta noche en Bolivia
          </span>
          <p className="max-w-sm text-2xl font-bold leading-snug">
            Tu próxima función te espera
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Comedia, conciertos y teatro con entrada digital en toda
            Bolivia.
          </p>
        </div>
        <div aria-hidden className="absolute bottom-8 left-16 flex gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
          <span className="h-1.5 w-1.5 rounded-full bg-gold-bright/30" />
          <span className="h-1.5 w-1.5 rounded-full bg-gold-bright/30" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  );
}
