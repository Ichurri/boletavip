import Image from "next/image";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { TicketIcon, SparkleIcon } from "@/components/ui/icons";

const statusLabels = {
  VALID: { label: "Válido", variant: "success" as const },
  USED: { label: "Usado", variant: "default" as const },
  CANCELLED: { label: "Cancelado", variant: "danger" as const },
};

export interface TicketCardData {
  id: string;
  code: string;
  qrCode: string | null;
  status: keyof typeof statusLabels;
  label: string;
  eventTitle: string;
  eventDate: Date | string;
  eventTime: string;
  venueName: string;
  venueCity: string;
  category: string;
  usedAt: Date | string | null;
}

/* Deterministic 5-digit "folio" derived from the ticket's UUID code — the
   ticket already has a real unique identifier (code/QR); this is purely
   the decorative stub number the mockup calls "N.º de talón". */
function folioFromCode(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  return String(hash % 100000).padStart(5, "0");
}

export function TicketCard({ ticket }: { ticket: TicketCardData }) {
  const statusInfo = statusLabels[ticket.status];
  const cancelled = ticket.status === "CANCELLED";
  const used = ticket.status === "USED";

  return (
    <div
      className="dark relative overflow-hidden rounded-[22px] text-card-foreground shadow-ticket transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgb(142_92_255/0.32),0_28px_56px_-16px_rgb(0_0_0/0.6)] focus-within:-translate-y-0.5 focus-within:shadow-[0_0_0_1px_rgb(142_92_255/0.32),0_28px_56px_-16px_rgb(0_0_0/0.6)] motion-reduce:hover:translate-y-0"
      style={{ backgroundImage: "var(--ticket-surface)" }}
    >
      <SparkleIcon
        aria-hidden="true"
        className="absolute right-4 top-4 h-[18px] w-[18px] text-gold opacity-85"
      />

      <div className="flex flex-col gap-2.5 px-[22px] pb-[18px] pt-[22px]">
        <Logo className="h-4 w-auto" />

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold">
            {ticket.category}
          </span>
          <h4
            className={cn(
              "text-xl font-extrabold leading-tight tracking-tight text-card-foreground",
              cancelled && "text-muted-foreground line-through",
            )}
          >
            {ticket.eventTitle}
          </h4>
          <span className="text-xs font-medium text-muted-foreground">
            {formatDate(ticket.eventDate)} · {ticket.eventTime} hrs ·{" "}
            {ticket.venueName}, {ticket.venueCity}
          </span>
        </div>

        <div className="mt-0.5 flex justify-center">
          <div className="relative">
            <div
              aria-hidden="true"
              className="animate-ticket-glow absolute -inset-4 rounded-full blur-[6px]"
              style={{ backgroundImage: "var(--spotlight)" }}
            />
            {ticket.qrCode ? (
              <Image
                src={ticket.qrCode}
                alt={`QR del boleto ${ticket.label}`}
                width={96}
                height={96}
                unoptimized
                className={cn(
                  "relative rounded-xl bg-qr-frame p-[9px] transition-opacity duration-300",
                  used && "opacity-45",
                )}
              />
            ) : (
              <div className="relative flex h-[114px] w-[114px] items-center justify-center rounded-xl bg-qr-frame text-primary">
                <TicketIcon className="h-10 w-10" />
              </div>
            )}
          </div>
        </div>

        <span className="text-center font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-gold">
          {ticket.label}
        </span>
      </div>

      <div className="relative mx-[22px]" aria-hidden="true">
        <div className="border-t-2 border-dashed border-white/20" />
        <span className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full bg-[#0f0b1c]" />
        <span className="absolute -right-[9px] -top-[9px] h-[18px] w-[18px] rounded-full bg-[#0f0b1c]" />
      </div>

      <div className="flex flex-col gap-3 rounded-b-[22px] bg-[var(--ticket-stub)] px-[22px] pb-[18px] pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm font-extrabold tracking-[0.06em] text-gold-bright">
            N.º {folioFromCode(ticket.code)}
          </span>
          <div className="flex flex-col items-end gap-0.5">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {used && ticket.usedAt && (
              <span className="text-[10px] text-muted-foreground">
                {formatDateTime(ticket.usedAt)}
              </span>
            )}
          </div>
        </div>

        {ticket.qrCode && (
          <div className="flex gap-2.5">
            <a
              href={`/api/tickets/${ticket.id}/pdf`}
              className={buttonVariants({
                variant: "gold",
                size: "md",
                className: "flex-1 text-gold-bright",
              })}
            >
              Descargar PDF
            </a>
            <a
              href={ticket.qrCode}
              download={`boleto-${ticket.code.slice(0, 8)}.png`}
              className={buttonVariants({
                variant: "ghost",
                size: "md",
                className: "flex-1 bg-white/[0.06] text-card-foreground hover:bg-white/10",
              })}
            >
              Solo QR
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
