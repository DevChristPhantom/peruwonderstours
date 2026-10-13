import assert from "node:assert/strict";
import { test } from "node:test";

import { isCalendarDate, limaDayBoundary, reportDate } from "../src/lib/calendar-date.ts";

test("rechaza fechas imposibles sin normalizarlas ni lanzar errores", () => {
  for (const value of ["", "2026-2-01", "2026-99-99", "2026-00-01", "2026-01-00", "2026-04-31", "2026-02-29", "1900-02-29", "0000-01-01", "2026-10-13T00:00:00Z"]) {
    assert.equal(isCalendarDate(value), false, value);
    assert.equal(limaDayBoundary(value), undefined, value);
    assert.equal(limaDayBoundary(value, true), undefined, value);
  }
});

test("acepta días reales y aplica la regla gregoriana de años bisiestos", () => {
  for (const value of ["2026-02-28", "2024-02-29", "2000-02-29", "2026-12-31", "0099-01-01"]) {
    assert.equal(isCalendarDate(value), true, value);
  }
});

test("auditoría incluye el día completo de Lima cruzando el límite UTC", () => {
  assert.equal(limaDayBoundary("2026-12-31"), "2026-12-31T05:00:00.000Z");
  assert.equal(limaDayBoundary("2026-12-31", true), "2027-01-01T04:59:59.999Z");
});

test("pagos conserva fechas válidas pasadas y vuelve a hoy para futuras o inválidas", () => {
  const today = "2026-10-13";
  assert.equal(reportDate("2026-10-12", today), "2026-10-12");
  assert.equal(reportDate(today, today), today);
  for (const value of ["2026-10-14", "2026-02-30", "2026-99-99", ""]) {
    assert.equal(reportDate(value, today), today, value);
  }
});
