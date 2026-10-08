import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseMarkdown } from "./markdown";

/**
 * Borradores legales de `docs/legal/*.md` (compliance-peru-analyst). Se publican tal cual con un
 * aviso visible de BORRADOR (brain/wiki/normativa/informacion-al-consumidor.md). Se descarta el
 * preámbulo interno (todo lo anterior al segundo H1: notas para el cliente "eliminar antes de
 * publicar") y se conserva la versión del borrador para mostrarla en el aviso.
 */

export const LEGAL_DOCUMENTS = {
  terminos: "terminos-y-condiciones.md",
  privacidad: "politica-de-privacidad.md",
  cancelacion: "politica-de-cancelacion-y-reembolso.md",
  cookies: "politica-de-cookies.md",
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

export interface LegalDocument {
  title: string;
  draftVersion: string | null;
  blocks: ReturnType<typeof parseMarkdown>;
}

function legalDir(): string {
  // `next build`/`next start` corren con cwd = apps/web; se acepta también la raíz del monorepo.
  // turbopackIgnore: la carpeta se incluye explícitamente con outputFileTracingIncludes (next.config.ts);
  // sin la marca, Turbopack rastrearía todo el proyecto por el acceso dinámico.
  const root = /* turbopackIgnore: true */ process.cwd();
  const candidates = [path.join(root, "../../docs/legal"), path.join(root, "docs/legal")];
  const found = candidates.find((dir) => existsSync(dir));
  if (!found) throw new Error("No se encontró docs/legal (borradores legales).");
  return found;
}

export function loadLegalDocument(key: LegalDocumentKey): LegalDocument {
  const raw = readFileSync(path.join(legalDir(), LEGAL_DOCUMENTS[key]), "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const h1 = lines.map((l, i) => (/^#\s/.test(l) ? i : -1)).filter((i) => i >= 0);
  // Primer H1 = "BORRADOR — ..."; segundo H1 = título real del documento.
  const start = h1.length > 1 ? h1[1] : (h1[0] ?? 0);
  const preamble = lines.slice(0, start).join("\n");
  // "Versión del borrador: 0.1 (2026-10-07)." → "0.1 (2026-10-07)"
  const version = /Versión del borrador:\s*([^)\n]*\))/.exec(preamble)?.[1]?.trim() ?? null;
  const title = lines[start]?.replace(/^#\s+/, "").trim() || "Documento legal";
  return { title, draftVersion: version, blocks: parseMarkdown(lines.slice(start + 1).join("\n")) };
}
