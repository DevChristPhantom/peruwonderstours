/**
 * Generador de calendarios iCalendar (RFC 5545) para "Mi viaje" y el voucher (HU-B.A5).
 * Sin datos personales: solo tour, fechas, ciudad, código de reserva y enlaces públicos.
 */

export interface CalendarEvent {
  uid: string;
  title: string;
  /** Primer día `YYYY-MM-DD` (calendario de Lima). */
  date: string;
  /** Duración en días (eventos de día completo). */
  days: number;
  /** Hora de recojo `HH:MM` en hora de Lima, si ya se conoce. */
  pickupTime?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
}

const LIMA_TZ = "America/Lima";

/** Perú no usa horario de verano: UTC−5 todo el año. */
const VTIMEZONE_LIMA = [
  "BEGIN:VTIMEZONE",
  `TZID:${LIMA_TZ}`,
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0500",
  "TZNAME:-05",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Pliega líneas a 75 octetos (RFC 5545 §3.1) sin partir caracteres UTF-8. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // las continuaciones empiezan con un espacio
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (iso: string) => iso.replace(/-/g, "");

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildIcs(events: readonly CalendarEvent[], options: { name: string; now?: Date }): string {
  const stamp = utcStamp(options.now ?? new Date());
  const timed = events.some((e) => e.pickupTime && /^\d{2}:\d{2}$/.test(e.pickupTime));
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Peru Wonders Tours//Mi viaje//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `X-WR-TIMEZONE:${LIMA_TZ}`,
    ...(timed ? VTIMEZONE_LIMA : []),
  ];
  for (const event of events) {
    const days = Math.max(1, Math.floor(event.days));
    lines.push("BEGIN:VEVENT", `UID:${escapeText(event.uid)}`, `DTSTAMP:${stamp}`);
    if (event.pickupTime && /^\d{2}:\d{2}$/.test(event.pickupTime)) {
      const time = `${event.pickupTime.replace(":", "")}00`;
      const lastDay = addDaysIso(event.date, days - 1);
      lines.push(
        `DTSTART;TZID=${LIMA_TZ}:${compactDate(event.date)}T${time}`,
        // Sin hora de fin publicada: el evento cubre hasta el final del último día del tour.
        `DTEND;TZID=${LIMA_TZ}:${compactDate(lastDay)}T235900`,
      );
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
        `DTEND;VALUE=DATE:${compactDate(addDaysIso(event.date, days))}`,
        "TRANSP:TRANSPARENT",
      );
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Descarga el .ics en el navegador (sin pasar por el servidor). */
export function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Texto de recojo cuando aún no hay hora (la API no la expone todavía). */
export const PICKUP_PENDING = "Hora y punto de recojo: te los confirmamos por WhatsApp (hora de Lima).";
