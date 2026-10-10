#!/usr/bin/env node
/**
 * Une los diccionarios por namespace (`messages/<idioma>/<namespace>.json`) en
 * `messages/<idioma>.json`, que es lo que cargan `src/i18n/request.ts` y `global.d.ts`.
 *
 * - Cada archivo `<namespace>.json` aporta la clave de primer nivel `<namespace>`.
 * - Verifica que `en` tenga exactamente las mismas claves que `es` (idioma de referencia).
 * - `--check`: solo valida (no escribe); falla si el archivo unido está desactualizado.
 *
 * Uso: `node scripts/build-messages.mjs [--check]`
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const locales = ["es", "en"];
const referenceLocale = "es";
const checkOnly = process.argv.includes("--check");

/** Carga y une los namespaces de un idioma (orden alfabético para un diff estable). */
function loadLocale(locale) {
  const dir = join(root, locale);
  const merged = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const namespace = file.replace(/\.json$/, "");
    try {
      merged[namespace] = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      throw new Error(`JSON inválido en messages/${locale}/${file}: ${error.message}`);
    }
  }
  return merged;
}

/** Lista plana de claves hoja: `home.hero.title`. */
function flatKeys(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flatKeys(child, prefix ? `${prefix}.${key}` : key));
}

const dictionaries = Object.fromEntries(locales.map((locale) => [locale, loadLocale(locale)]));
const referenceKeys = new Set(flatKeys(dictionaries[referenceLocale]));
let failed = false;

for (const locale of locales.filter((l) => l !== referenceLocale)) {
  const keys = new Set(flatKeys(dictionaries[locale]));
  const missing = [...referenceKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !referenceKeys.has(k));
  if (missing.length || extra.length) {
    failed = true;
    if (missing.length) console.error(`[messages] Faltan en "${locale}":\n  ${missing.join("\n  ")}`);
    if (extra.length) console.error(`[messages] Sobran en "${locale}" (no existen en "${referenceLocale}"):\n  ${extra.join("\n  ")}`);
  }
}

for (const locale of locales) {
  const target = join(root, `${locale}.json`);
  const content = `${JSON.stringify(dictionaries[locale], null, 2)}\n`;
  if (checkOnly) {
    if (!existsSync(target) || readFileSync(target, "utf8") !== content) {
      failed = true;
      console.error(`[messages] messages/${locale}.json está desactualizado: ejecuta "node scripts/build-messages.mjs".`);
    }
  } else {
    writeFileSync(target, content);
  }
}

if (failed) process.exit(1);
console.log(`[messages] OK: ${referenceKeys.size} claves por idioma (${locales.join(", ")}).`);
