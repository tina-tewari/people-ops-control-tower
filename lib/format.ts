export type ValueFormat = "text" | "usd" | "pct" | "date";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatValue(v: string | number | null | undefined, format: ValueFormat): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    if (format === "usd") return usd.format(v);
    if (format === "pct") return `${v}%`;
    return String(v);
  }
  return format === "date" ? formatDate(v) : v;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatPct(ratio: number | null, digits = 0): string {
  return ratio == null ? "—" : `${(ratio * 100).toFixed(digits)}%`;
}

export function formatRatio(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(1)}×`;
}
