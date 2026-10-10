"use client";

import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/styles";
import { checkUpload, MEDIA_TYPES, type MediaFolder } from "@/lib/content";

export interface ImageValue {
  storageKey: string;
  url: string | null;
}

/**
 * Selector de imagen reutilizable: sube el archivo al BFF (`/bff/medios`, que lo reenvía a la API
 * con el token del staff) y deja la `storageKey` en un `<input type="hidden" name={name}>` para el
 * formulario que lo contiene. JPEG, PNG, WebP o AVIF, máx. 8 MB.
 */
export function ImageUploader({
  name,
  folder,
  label = "Imagen de portada",
  initial,
  disabled,
  canUpload = true,
  onChange,
}: {
  name: string;
  folder: MediaFolder;
  label?: string;
  initial?: ImageValue | null;
  disabled?: boolean;
  /** false si el rol no tiene `media:upload`: solo se ve la imagen actual. */
  canUpload?: boolean;
  onChange?: (value: ImageValue | null) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<ImageValue | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (next: ImageValue | null) => {
    setValue(next);
    onChange?.(next);
  };

  async function upload(file: File) {
    setError(null);
    const problem = checkUpload(file);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/bff/medios?folder=${folder}`, { method: "POST", body: form, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { data?: { storageKey: string; url: string }; error?: { message: string } } | null;
      if (!res.ok || !json?.data) {
        setError(json?.error?.message ?? "No se pudo subir la imagen. Intenta de nuevo.");
        return;
      }
      update({ storageKey: json.data.storageKey, url: json.data.url });
    } catch {
      setError("No se pudo conectar con el panel. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled || busy} aria-busy={busy || undefined}>
      <legend className="text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={value?.storageKey ?? ""} />
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex aspect-video w-48 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-muted">
          {value?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa de un medio propio; no requiere optimización.
            <img src={value.url} alt="Vista previa de la imagen seleccionada" className="h-full w-full object-cover" />
          ) : value?.storageKey ? (
            <span className="break-all p-2 text-xs text-foreground-muted">{value.storageKey}</span>
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs text-foreground-muted">
              <ImageIcon aria-hidden size={20} /> Sin imagen
            </span>
          )}
        </div>
        {canUpload ? (
          <div className="space-y-2">
            <input
              ref={inputRef}
              id={id}
              type="file"
              accept={MEDIA_TYPES.join(",")}
              className="peer sr-only"
              aria-describedby={`${id}-ayuda`}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) void upload(file);
              }}
            />
            {/* El input real queda oculto: el foco del teclado se refleja en esta etiqueta-botón. */}
            <label
              htmlFor={id}
              className={buttonClass("outline", "sm", `peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid ${busy ? "pointer-events-none opacity-60" : ""}`)}
            >
              {busy ? <Loader2 aria-hidden size={16} className="animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden size={16} />}
              {busy ? "Subiendo…" : value ? "Cambiar imagen" : "Subir imagen"}
            </label>
            {value ? (
              <button type="button" className={buttonClass("ghost", "sm", "text-danger")} onClick={() => update(null)}>
                <Trash2 aria-hidden size={16} /> Quitar
              </button>
            ) : null}
            <p id={`${id}-ayuda`} className="text-xs text-foreground-muted">
              JPEG, PNG, WebP o AVIF. Máximo 8 MB.
            </p>
          </div>
        ) : null}
      </div>
      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}
    </fieldset>
  );
}
