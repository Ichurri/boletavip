"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { cn, formatDate } from "@/lib/utils";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SCAN_INTERVAL_MS = 300;
/** Ignore re-reads of the same QR for this long so a ticket held in front of
 * the camera doesn't flip from "válida" to "ya utilizado" instantly. */
const SAME_CODE_COOLDOWN_MS = 5000;

interface TicketSummary {
  code: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  label: string;
  buyerName: string;
}

interface VerifyOutcome {
  result:
    | "ACCEPTED"
    | "ALREADY_USED"
    | "CANCELLED"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "INVALID_CODE"
    | "ERROR";
  error?: string;
  usedAt?: string | null;
  ticket?: TicketSummary;
}

const usedAtFormatter = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "short",
  timeStyle: "medium",
});

export function TicketScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);

  const verify = useCallback(async (code: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    lastScanRef.current = { code, at: Date.now() };
    setVerifying(true);

    try {
      const response = await fetch("/api/tickets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => null);
      setOutcome(
        data?.result
          ? (data as VerifyOutcome)
          : { result: "ERROR", error: "No se pudo verificar el boleto" },
      );
    } catch {
      setOutcome({ result: "ERROR", error: "Sin conexión con el servidor" });
    } finally {
      setVerifying(false);
      verifyingRef.current = false;
      setManualCode("");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      intervalRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video || verifyingRef.current || video.readyState < 2) return;

        canvasRef.current ??= document.createElement("canvas");
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context || canvas.width === 0) return;

        context.drawImage(video, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, imageData.width, imageData.height);

        if (qr && UUID_PATTERN.test(qr.data.trim())) {
          const code = qr.data.trim();
          const last = lastScanRef.current;
          if (
            last &&
            last.code === code &&
            Date.now() - last.at < SAME_CODE_COOLDOWN_MS
          ) {
            return;
          }
          verify(code);
        }
      }, SCAN_INTERVAL_MS);
    } catch {
      setCameraError(
        "No se pudo acceder a la cámara. Dale permiso en el navegador o usá el código manual.",
      );
    }
  }, [verify]);

  useEffect(() => stopCamera, [stopCamera]);

  const outcomeStyles: Record<
    VerifyOutcome["result"],
    { container: string; title: string }
  > = {
    ACCEPTED: {
      container:
        "border-emerald-500/50 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/40",
      title: "✅ Entrada válida — dejá pasar",
    },
    ALREADY_USED: {
      container: "border-danger/50 bg-red-50 dark:bg-red-950/40",
      title: "⛔ Boleto ya utilizado",
    },
    CANCELLED: {
      container: "border-danger/50 bg-red-50 dark:bg-red-950/40",
      title: "⛔ Boleto cancelado",
    },
    NOT_FOUND: {
      container: "border-danger/50 bg-red-50 dark:bg-red-950/40",
      title: "⛔ Boleto inexistente",
    },
    FORBIDDEN: {
      container: "border-amber-500/50 bg-amber-50 dark:bg-amber-950/40",
      title: "⚠️ Boleto de otro organizador",
    },
    INVALID_CODE: {
      container: "border-amber-500/50 bg-amber-50 dark:bg-amber-950/40",
      title: "⚠️ Código inválido",
    },
    ERROR: {
      container: "border-amber-500/50 bg-amber-50 dark:bg-amber-950/40",
      title: "⚠️ Error de verificación",
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="relative overflow-hidden rounded-lg border border-border bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                "aspect-video w-full object-cover",
                !cameraActive && "hidden",
              )}
            />
            {!cameraActive && (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 text-center">
                <p className="px-6 text-sm text-white/70">
                  Activá la cámara y apuntá al QR del boleto
                </p>
                <Button type="button" onClick={startCamera}>
                  Iniciar cámara
                </Button>
              </div>
            )}
            {cameraActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            )}
          </div>

          {cameraError && <p className="text-sm text-danger">{cameraError}</p>}

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {cameraActive
                ? verifying
                  ? "Verificando..."
                  : "Buscando QR..."
                : "Cámara apagada"}
            </p>
            {cameraActive && (
              <Button type="button" variant="ghost" size="sm" onClick={stopCamera}>
                Apagar cámara
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <Label htmlFor="manual-code">O ingresá el código manualmente</Label>
            <div className="flex gap-2">
              <Input
                id="manual-code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                disabled={verifying || !UUID_PATTERN.test(manualCode.trim())}
                onClick={() => verify(manualCode.trim())}
              >
                Verificar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {outcome && (
        <Card className={cn("border-2", outcomeStyles[outcome.result].container)}>
          <CardContent className="flex flex-col gap-3 p-6">
            <p className="text-xl font-bold">
              {outcomeStyles[outcome.result].title}
            </p>

            {outcome.error && outcome.result !== "ACCEPTED" && (
              <p className="text-sm text-muted-foreground">
                {outcome.error}
                {outcome.result === "ALREADY_USED" && outcome.usedAt && (
                  <> — el {usedAtFormatter.format(new Date(outcome.usedAt))}</>
                )}
              </p>
            )}

            {outcome.ticket && (
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-semibold">{outcome.ticket.eventTitle}</p>
                <p className="text-muted-foreground">
                  {outcome.ticket.label} · {outcome.ticket.buyerName}
                </p>
                <p className="text-muted-foreground">
                  {formatDate(outcome.ticket.eventDate)} ·{" "}
                  {outcome.ticket.eventTime} hrs
                </p>
                <code className="text-xs text-muted-foreground">
                  {outcome.ticket.code}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
