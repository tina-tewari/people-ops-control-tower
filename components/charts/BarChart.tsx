// Horizontal bar chart (single or stacked), server-rendered. Hover a row for a
// tooltip; totals are direct-labeled; a legend appears for 2+ series.

import Link from "next/link";
import type { ReactNode } from "react";

export interface BarSeries {
  name: string;
  /** CSS color, usually a token like "var(--series-1)". */
  color: string;
}

export interface BarRow {
  label: string;
  sublabel?: string;
  values: number[];
  /** Per-row color override for single-series status bars. */
  color?: string;
  href?: string;
  tooltip?: ReactNode;
  /** Text at the end of the bar; defaults to the row total. */
  valueLabel?: string;
}

export interface ThresholdMarker {
  value: number;
  label: string;
}

export function BarChart({
  rows,
  series,
  max,
  markers = [],
  labelWidth = "9rem",
  legend,
}: {
  rows: BarRow[];
  series: BarSeries[];
  max?: number;
  markers?: ThresholdMarker[];
  labelWidth?: string;
  /** Extra legend entries (e.g. status meanings for per-row colors). */
  legend?: BarSeries[];
}) {
  const domain = Math.max(
    1,
    max ?? 0,
    ...rows.map((r) => r.values.reduce((a, b) => a + b, 0)),
    ...markers.map((m) => m.value),
  );
  const legendItems = legend ?? (series.length > 1 ? series : []);
  const grid = { gridTemplateColumns: `${labelWidth} 1fr 3rem` };

  return (
    <figure>
      {legendItems.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-ink-2">
          {legendItems.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        {markers.length > 0 && (
          <div className="pointer-events-none absolute inset-0 grid gap-3" style={grid}>
            <span />
            <div className="relative">
              {markers.map((m) => (
                <span
                  key={m.label}
                  className="absolute -top-5 bottom-0 border-l border-dashed border-ink-3"
                  style={{ left: `${(m.value / domain) * 100}%` }}
                >
                  <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[10px] text-ink-3">{m.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <ul className={`space-y-2.5 ${markers.length ? "pt-5" : ""}`}>
          {rows.map((r) => {
            const total = r.values.reduce((a, b) => a + b, 0);
            const segments = r.values
              .map((v, i) => ({ v, color: r.color ?? series[i]?.color }))
              .filter((s) => s.v > 0);
            const label = (
              <span className="block truncate text-xs text-ink-2">
                {r.label}
                {r.sublabel && <span className="text-ink-3"> · {r.sublabel}</span>}
              </span>
            );
            return (
              <li key={r.label + (r.sublabel ?? "")} className="group relative grid items-center gap-3" style={grid}>
                {r.href ? (
                  <Link href={r.href} className="hover:text-accent">{label}</Link>
                ) : (
                  label
                )}
                <div className="flex h-4 items-center">
                  <div className="flex h-full gap-0.5" style={{ width: `${(total / domain) * 100}%` }}>
                    {segments.map((s, i) => (
                      <span
                        key={i}
                        className={`h-full ${i === segments.length - 1 ? "rounded-r-[4px]" : ""}`}
                        style={{ flexGrow: s.v, background: s.color }}
                      />
                    ))}
                  </div>
                  {total === 0 && <span className="h-3 w-px bg-ink-3" />}
                </div>
                <span className="tabular text-right text-xs font-medium">{r.valueLabel ?? total}</span>
                {r.tooltip && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute top-5 z-10 hidden w-max max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg group-hover:block"
                    style={{ left: labelWidth }}
                  >
                    {r.tooltip}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </figure>
  );
}
