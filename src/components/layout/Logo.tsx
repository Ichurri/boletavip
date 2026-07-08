import { cn } from "@/lib/utils";

/** Üticket app icon: white Ü glyph on a rounded purple square (brand v1.0). */
export function UTicketMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M10.5 12v6a5.5 5.5 0 0 0 11 0v-6"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.5" r="1.7" fill="#fff" />
      <circle cx="20" cy="7.5" r="1.7" fill="#fff" />
    </svg>
  );
}

/** Wordmark: purple Ü + foreground "ticket" (secondary variation on light,
 * negative on dark via tokens). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <UTicketMark className="h-8 w-8 shrink-0" />
      <span className="font-display text-xl font-extrabold tracking-tight">
        <span className="text-primary">Ü</span>ticket
      </span>
    </span>
  );
}
