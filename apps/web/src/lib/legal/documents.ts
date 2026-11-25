import "server-only";

import { parseMarkdown } from "./markdown";
import type { Locale } from "@/i18n/routing";

/**
 * Borradores legales de `docs/legal/*.md` (compliance-peru-analyst). Se publican tal cual con un
 * aviso visible de BORRADOR (brain/wiki/normativa/informacion-al-consumidor.md). Se descarta el
 * preámbulo interno (todo lo anterior al segundo H1: notas para el cliente "eliminar antes de
 * publicar") y se conserva la versión del borrador para mostrarla en el aviso.
 *
 * L1 (auditoría sprint 3): el contenido se INCRUSTA en el build. `next.config.ts` lee los `.md` con
 * una ruta relativa a su propio archivo (`__dirname`) y los expone en `env` (`PWT_LEGAL_*`), que Next
 * reemplaza de forma estática. Ya no se usa `process.cwd()` ni el disco en tiempo de ejecución:
 * funciona con `next dev <ruta>` desde cualquier carpeta, con `next start` y en una salida standalone.
 * (Turbopack 16.3 no resolvió `import … .md` como texto: ni `?raw` ni `type: "raw"` ni `import.meta.glob`.)
 * Al editar un borrador hay que reiniciar `next dev` o volver a compilar.
 */
const RAW_DOCUMENTS = {
  terminos: process.env.PWT_LEGAL_TERMINOS,
  privacidad: process.env.PWT_LEGAL_PRIVACIDAD,
  cancelacion: process.env.PWT_LEGAL_CANCELACION,
  cookies: process.env.PWT_LEGAL_COOKIES,
  promociones: process.env.PWT_LEGAL_PROMOCIONES,
  resenas: process.env.PWT_LEGAL_RESENAS,
  esnna: process.env.PWT_LEGAL_ESNNA,
};
const PORTUGUESE_DOCUMENTS = {
  terminos: process.env.PWT_LEGAL_PT_TERMINOS,
  privacidad: process.env.PWT_LEGAL_PT_PRIVACIDAD,
  cancelacion: process.env.PWT_LEGAL_PT_CANCELACION,
  cookies: process.env.PWT_LEGAL_PT_COOKIES,
  promociones: process.env.PWT_LEGAL_PT_PROMOCIONES,
  resenas: process.env.PWT_LEGAL_PT_RESENAS,
  esnna: process.env.PWT_LEGAL_PT_ESNNA,
};

/** Documentos con versión propia en inglés (los demás se muestran en español con aviso). */
const ENGLISH_DOCUMENTS: Partial<Record<keyof typeof RAW_DOCUMENTS, string | undefined>> = {
  cancelacion: process.env.PWT_LEGAL_EN_CANCELACION,
};

export function hasEnglishVersion(key: LegalDocumentKey): boolean {
  return !!ENGLISH_DOCUMENTS[key];
}

export const LEGAL_DOCUMENTS = {
  terminos: "terminos-y-condiciones.md",
  privacidad: "politica-de-privacidad.md",
  cancelacion: "politica-de-cancelacion-y-reembolso.md",
  cookies: "politica-de-cookies.md",
  promociones: "politica-de-promociones.md",
  resenas: "politica-de-resenas.md",
  esnna: "prevencion-esnna.md",
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

export interface LegalDocument {
  title: string;
  /** El archivo empieza con "# BORRADOR …" / "# RASCUNHO …": se muestra el aviso de borrador. */
  draft: boolean;
  draftVersion: string | null;
  blocks: ReturnType<typeof parseMarkdown>;
}

export function loadLegalDocument(key: LegalDocumentKey, locale: Locale = "es"): LegalDocument {
  const source = locale === "pt" ? PORTUGUESE_DOCUMENTS[key] : locale === "en" ? (ENGLISH_DOCUMENTS[key] ?? RAW_DOCUMENTS[key]) : RAW_DOCUMENTS[key];
  if (!source) throw new Error(`No se encontró docs/legal/${LEGAL_DOCUMENTS[key]} (borrador legal) al compilar.`);
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const h1 = lines.map((l, i) => (/^#\s/.test(l) ? i : -1)).filter((i) => i >= 0);
  // Borrador: primer H1 = "BORRADOR — ..." y segundo H1 = título real. Versión final: un solo H1.
  const draft = /^#\s+(BORRADOR|RASCUNHO)\b/i.test(lines[h1[0] ?? 0] ?? "");
  const start = draft && h1.length > 1 ? h1[1] : (h1[0] ?? 0);
  const preamble = lines.slice(0, start).join("\n");
  // "Versión del borrador: 0.1 (2026-10-07)." → "0.1 (2026-10-07)"
  const version = /(?:Versión del borrador|Versão do rascunho):\s*([^)\n]*\))/.exec(preamble)?.[1]?.trim() ?? null;
  const title = lines[start]?.replace(/^#\s+/, "").trim() || "Documento legal";
  return { title, draft, draftVersion: draft ? version : null, blocks: parseMarkdown(lines.slice(start + 1).join("\n")) };
}
