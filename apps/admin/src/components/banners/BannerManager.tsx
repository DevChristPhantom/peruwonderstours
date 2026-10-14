"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { FileCode2, Loader2, RefreshCw, Upload } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Section } from "@/components/ui/Layout";
import { buttonClass } from "@/components/ui/styles";
import { BANNER_MAX_BYTES, type HeroBanner } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok || !body || body.data === undefined) throw new Error(body?.error?.message ?? "No se pudo completar la operación. Recarga e intenta de nuevo.");
  return body.data;
}

export function BannerManager({ initial, canUpload, canEdit }: { initial: HeroBanner[]; canUpload: boolean; canEdit: boolean }) {
  const [records, setRecords] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const id = useId();
  const uploadRef = useRef<HTMLFormElement>(null);
  const replace = (record: HeroBanner) => setRecords((old) => [...old.filter((item) => item.id !== record.id), record].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)));
  async function refresh() {
    setBusy(true); setFeedback(null);
    try { setRecords(await request<HeroBanner[]>("/bff/banners")); }
    catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "No se pudo cargar la lista." }); }
    finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback(null);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !/\.html?$/i.test(file.name) || file.size === 0 || file.size > BANNER_MAX_BYTES) {
      setFeedback({ error: true, text: "Selecciona un archivo HTML válido, de hasta 16 MB." }); return;
    }
    setBusy(true);
    try {
      replace(await request<HeroBanner>("/bff/banners", { method: "POST", body: form }));
      uploadRef.current?.reset();
      setFeedback({ error: false, text: "Archivo guardado como inactivo. Actívalo cuando quieras mostrarlo en la portada." });
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "No se pudo subir el archivo." }); }
    finally { setBusy(false); }
  }
  async function update(record: HeroBanner, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback(null);
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    try {
      replace(await request<HeroBanner>(`/bff/banners?id=${encodeURIComponent(record.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: String(fields.get("title") ?? "").trim(), enabled: fields.get("enabled") === "on", sortOrder: Number(fields.get("sortOrder")), revision: record.revision }),
      }));
      setFeedback({ error: false, text: "Banner actualizado. Los activos aparecen en la portada según su orden." });
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "No se pudo guardar. Recarga la lista." }); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5" aria-busy={busy || undefined}>
    <Alert tone="info">Archivos .html o .htm autocontenidos, máximo 16 MB. Las imágenes deben venir incluidas en el archivo. Los nuevos banners quedan inactivos; su HTML se muestra aislado en la web y no se ejecuta dentro de este panel.</Alert>
    {feedback ? <Alert tone={feedback.error ? "danger" : "success"} role={feedback.error ? "alert" : "status"}>{feedback.text}</Alert> : null}
    {canUpload ? <Section title="Subir un banner" description="Dale un nombre que permita reconocerlo en la lista.">
      <form ref={uploadRef} onSubmit={(event) => void upload(event)}>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`${id}-title`} className="mb-1 block font-medium">Título</label><input id={`${id}-title`} name="title" required maxLength={120} className="field-input" placeholder="Ej. Experiencias en el Titicaca" /></div>
          <div><label htmlFor={`${id}-file`} className="mb-1 block font-medium">Archivo HTML</label><input id={`${id}-file`} name="file" type="file" accept=".html,.htm,text/html" required className="field-input" /></div>
          <button type="submit" className={buttonClass("primary", "md", "justify-self-start sm:col-span-2")}><Upload aria-hidden size={17} /> Subir como inactivo</button>
        </fieldset>
      </form>
    </Section> : null}
    <Section title="Banners guardados" description="Menor número de orden primero. Desactiva un banner para retirarlo de la portada." actions={<button type="button" disabled={busy} onClick={() => void refresh()} className={buttonClass("outline", "sm")}>{busy ? <Loader2 aria-hidden size={16} className="animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden size={16} />} Recargar</button>}>
      {records.length === 0 ? <EmptyState>Todavía no hay banners HTML. Sube el primero para comenzar.</EmptyState> : <div className="space-y-4">{records.map((record) => <form key={`${record.id}-${record.revision}`} onSubmit={(event) => void update(record, event)} className="rounded-md border border-border p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2"><FileCode2 aria-hidden size={18} className="text-primary" /><span className="font-semibold break-all">{record.title}</span><Badge tone={record.enabled ? "success" : "neutral"}>{record.enabled ? "Activo" : "Inactivo"}</Badge><span className="text-xs text-foreground-muted">{(record.bytes / 1024 / 1024).toLocaleString("es-PE", { maximumFractionDigits: 2 })} MB · {record.hasPoster ? "Imagen estática disponible" : "Sin imagen estática"}</span></div>
        <fieldset disabled={busy || !canEdit} className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_100px_auto_auto]">
          <div><label htmlFor={`${id}-${record.id}-title`} className="mb-1 block text-sm font-medium">Título</label><input id={`${id}-${record.id}-title`} name="title" required maxLength={120} defaultValue={record.title} className="field-input" /></div>
          <div><label htmlFor={`${id}-${record.id}-order`} className="mb-1 block text-sm font-medium">Orden</label><input id={`${id}-${record.id}-order`} name="sortOrder" type="number" min={0} max={999} step={1} required defaultValue={record.sortOrder} className="field-input" /></div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input name="enabled" type="checkbox" defaultChecked={record.enabled} className="size-5 accent-primary" /> Mostrar en portada</label>
          <button type="submit" className={buttonClass("outline", "md")}>Guardar cambios</button>
        </fieldset>
      </form>)}</div>}
    </Section>
  </div>;
}
