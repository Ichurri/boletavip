"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangleIcon } from "@/components/ui/icons";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (online) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
      <AlertTriangleIcon className="h-4 w-4 shrink-0" />
      Sin conexión — mostrando la última versión guardada.
      <button
        type="button"
        onClick={() => location.reload()}
        className="font-medium underline underline-offset-2 hover:opacity-80"
      >
        Reintentar
      </button>
    </div>
  );
}
