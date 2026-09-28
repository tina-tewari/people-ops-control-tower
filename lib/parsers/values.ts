import type { ISODate } from "@/lib/types";

export function str(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** Parses "135000", "135000.0", "$135,000". */
export function num(v: string | undefined): number | null {
  const t = str(v);
  if (t === null) return null;
  const n = Number(t.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function bool(v: string | undefined): boolean {
  return /^(true|yes|1)$/i.test((v ?? "").trim());
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Normalizes "2025-06-02" or "June 2, 2025" to an ISO date. */
export function isoDate(v: string | undefined | null): ISODate | null {
  const t = (v ?? "").trim();
  if (t === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    if (month >= 0) {
      return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    }
  }
  return null;
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Pulls "OTE $142,500" out of free-text comp descriptions. */
export function extractOte(text: string | null): number | null {
  const m = text?.match(/OTE\s*\$([\d,]+)/i);
  return m ? num(m[1]) : null;
}
