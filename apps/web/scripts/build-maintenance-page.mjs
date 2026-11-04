#!/usr/bin/env node
/**
 * Genera `public/mantenimiento.html`, la página que nginx/Caddy muestra cuando la web está apagada
 * (despliegue o caída). Fuente única: `src/lib/maintenance/maintenance.mjs` y el WhatsApp de `lib/site.ts`.
 *
 * Uso: `node scripts/build-maintenance-page.mjs [--check]` (`--check` falla si el archivo está desactualizado).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { maintenanceHtml } from "../src/lib/maintenance/maintenance.mjs";
import { SITE } from "../src/lib/site.ts";

const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "mantenimiento.html");
const html = maintenanceHtml({ whatsappDigits: SITE.whatsapp.digits, whatsappDisplay: SITE.whatsapp.display });

if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== html) {
    console.error('[mantenimiento] public/mantenimiento.html está desactualizado: ejecuta "node scripts/build-maintenance-page.mjs".');
    process.exit(1);
  }
  console.log("[mantenimiento] OK");
} else {
  writeFileSync(target, html);
  console.log("[mantenimiento] public/mantenimiento.html generado.");
}
