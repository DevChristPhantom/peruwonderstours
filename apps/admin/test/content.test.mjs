// Pruebas de las utilidades puras del backoffice de contenido.
// Ejecutar: node --test apps/admin/test/content.test.mjs (Node >= 23: quita los tipos de .ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkUpload, contactTargets, isPendingReview, moveItem, parseTags, resolveMediaUrl, slugify, toSortOrders, translationBadge } from "../src/lib/content.ts";

test("parseTags normaliza, quita duplicados y vacíos", () => {
  assert.deepEqual(parseTags(" Cusco, trekking ,, cusco,  Valle   Sagrado "), ["cusco", "trekking", "valle sagrado"]);
  assert.equal(parseTags(Array.from({ length: 30 }, (_, i) => `t${i}`).join(",")).length, 20);
  assert.deepEqual(parseTags(""), []);
});

test("moveItem sube y baja sin salirse de los bordes", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 1), ["a", "b", "c"]);
});

test("toSortOrders numera de 10 en 10", () => {
  assert.deepEqual(toSortOrders(["x", "y"]), [
    { id: "x", sortOrder: 10 },
    { id: "y", sortOrder: 20 },
  ]);
});

test("translationBadge distingue ausente, revisada y pendiente", () => {
  assert.equal(translationBadge(undefined).label, "Sin traducción");
  assert.equal(translationBadge(null).label, "Revisada por el equipo");
  assert.equal(translationBadge("machine_reviewed_pending_client").label, "Traducción automática pendiente de revisión");
  assert.equal(translationBadge("machine_reviewed_pending_client").tone, "warning");
  assert.ok(isPendingReview("machine_reviewed_pending_client"));
  assert.ok(!isPendingReview(null));
});

test("contactTargets replica las transiciones de la API", () => {
  assert.deepEqual(contactTargets("new"), ["answered", "archived"]);
  assert.deepEqual(contactTargets("answered"), ["archived"]);
  assert.deepEqual(contactTargets("archived"), ["new"]);
  assert.deepEqual(contactTargets("otro"), []);
});

test("slugify quita tildes y signos", () => {
  assert.equal(slugify("Machu Picchu: guía práctica 2026"), "machu-picchu-guia-practica-2026");
  assert.equal(slugify("  --Ñandú--  "), "nandu");
});

test("resolveMediaUrl acepta claves seguras y URLs absolutas", () => {
  assert.equal(resolveMediaUrl("blog/ab/abc.webp", "http://localhost:3001/media/"), "http://localhost:3001/media/blog/ab/abc.webp");
  assert.equal(resolveMediaUrl("https://cdn.example.com/a.jpg", "x"), "https://cdn.example.com/a.jpg");
  assert.equal(resolveMediaUrl("../etc/passwd", "http://h/media"), null);
  assert.equal(resolveMediaUrl("javascript:alert(1)", "http://h/media"), null);
  assert.equal(resolveMediaUrl(null, "http://h/media"), null);
});

test("checkUpload valida tipo y tamaño", () => {
  assert.equal(checkUpload({ type: "image/webp", size: 1000 }), null);
  assert.match(checkUpload({ type: "image/gif", size: 1000 }) ?? "", /Formato/);
  assert.match(checkUpload({ type: "image/png", size: 9 * 1024 * 1024 }) ?? "", /8 MB/);
  assert.match(checkUpload({ type: "image/png", size: 0 }) ?? "", /vacío/);
});
