import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Renderizador Markdown MÍNIMO para los borradores legales de `docs/legal/*.md` (sin dependencias
 * nuevas y sin `dangerouslySetInnerHTML`: todo se convierte en elementos React, así que el texto
 * nunca se interpreta como HTML). Soporta lo que usan esos documentos: títulos, párrafos, listas
 * (numeradas y con viñetas, con líneas de continuación), tablas, citas, **negrita**, `código`,
 * enlaces y marcas `[POR CONFIRMAR: ...]`, que se resaltan para que se vean como pendientes.
 */

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "quote"; text: string };

const LIST_ITEM = /^\s*(?:([-*])|(\d+)\.)\s+(.*)$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const [header, , ...body] = rows;
      blocks.push({ kind: "table", header: header ?? [], rows: body.filter((r) => !r.every((c) => /^:?-+:?$/.test(c))) });
      continue;
    }
    if (line.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        parts.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: parts.join("\n") });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = !!item[2];
      const items: string[] = [];
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]);
        if (m && !!m[2] === ordered) {
          items.push(m[3]);
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i++;
        } else break;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\||>)/.test(lines[i]) && !LIST_ITEM.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "paragraph", text: para.join(" ") });
  }
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[POR CONFIRMAR[^\]]*\]|\[A VALIDAR[^\]]*\]|\[[^\]]+\]\([^)]+\))/g;

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={i} className="rounded-sm bg-surface-muted px-1 font-mono text-sm">{part.slice(1, -1)}</code>;
    if (/^\[(POR CONFIRMAR|A VALIDAR)/.test(part)) {
      return (
        <mark key={i} className="rounded-sm bg-warning-soft px-1 text-warning">
          {part}
        </mark>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = link[2];
      if (href.startsWith("/")) {
        return (
          <Link key={i} href={href} className="pwt-link">
            {link[1]}
          </Link>
        );
      }
      if (/^https?:\/\//.test(href)) {
        return (
          <a key={i} href={href} className="pwt-link" target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>
        );
      }
      return link[1];
    }
    return part;
  });
}

export function Markdown({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading": {
            const level = Math.min(6, b.level + 1); // el H1 de la página lo pone el layout
            const Tag = `h${level}` as "h2";
            return (
              <Tag key={i} className={level === 2 ? "mt-10 font-display text-h3 font-medium" : "mt-6 text-h4 font-medium"}>
                {renderInline(b.text)}
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={i} className="mt-4">
                {renderInline(b.text)}
              </p>
            );
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`mt-4 space-y-2 pl-6 ${b.ordered ? "list-decimal" : "list-disc"}`}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="mt-4 border-l-4 border-border-strong pl-4 text-foreground-muted">
                {b.text.split("\n").map((l, j) => (
                  <p key={j}>{renderInline(l)}</p>
                ))}
              </blockquote>
            );
          case "table":
            return (
              <div key={i} className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      {b.header.map((h, j) => (
                        <th key={j} scope="col" className="border-b border-border-strong p-2 font-medium">
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-border align-top">
                        {r.map((c, k) => (
                          <td key={k} className="p-2">
                            {renderInline(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}
