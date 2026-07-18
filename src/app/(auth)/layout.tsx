import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-1">
      {/* Desktop-only brand panel (spec #9a) — always the night-constant
          surface, same trick as the ticket/hero/scanner. Mobile just keeps
          the global Navbar's logo, so nothing is added there. */}
      <div
        className="dark relative hidden w-1/2 overflow-hidden text-foreground lg:flex lg:items-center"
        style={{ backgroundImage: "var(--ticket-surface)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 opacity-80"
          style={{ backgroundImage: "var(--spotlight)" }}
        />
        <div className="relative flex flex-col gap-4 px-16">
          <Logo className="h-8 w-auto" />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-gold-bright">
            La boletería digital de Bolivia
          </span>
          <p className="max-w-sm text-2xl font-bold leading-snug">
            Tu entrada en un clic.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Comprá y vendé boletos digitales con QR único, pago por
            transferencia y check-in en la puerta.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  );
}
