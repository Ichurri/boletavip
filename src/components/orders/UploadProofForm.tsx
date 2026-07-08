"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function UploadProofForm({
  orderId,
  replacing = false,
}: {
  orderId: string;
  replacing?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload() {
    if (!file) return;
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/orders/${orderId}/proof`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo subir el comprobante");
      return;
    }
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full cursor-pointer rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
      />
      <Button
        type="button"
        onClick={upload}
        disabled={!file || uploading}
        className="w-full"
      >
        {uploading
          ? "Subiendo..."
          : replacing
            ? "Reemplazar comprobante"
            : "Subir comprobante de pago"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
