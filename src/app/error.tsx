"use client";

import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon } from "@/components/ui/icons";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/12 text-danger">
        <AlertTriangleIcon className="h-7 w-7" />
      </span>
      <h1 className="text-3xl font-bold">Algo salió mal</h1>
      <p className="max-w-md text-muted-foreground">
        Ocurrió un error inesperado. Podés intentar de nuevo; si el problema
        persiste, volvé más tarde.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
