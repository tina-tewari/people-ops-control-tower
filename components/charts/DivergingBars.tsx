// Diverging horizontal bars around zero: positive grows right (blue), negative left (red).

import type { ReactNode } from "react";

export interface DivergingRow {
  label: string;
  value: number;
  tooltip?: ReactNode;
}

export function DivergingBars({
  rows,
  positiveLabel,
  negativeLabel,
}: {
  rows: DivergingRow[];
  positiveLabel: string;
  negativeLabel: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <figure>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-negative" /> {negativeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-series-1" /> {positiveLabel}
        </span>
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const pct = (Math.abs(r.value) / max) * 42; // leave room for the value label
          return (
            <li key={r.label} className="group relative grid grid-cols-[8.5rem_1fr] items-center gap-3">
              <span className="truncate text-xs text-ink-2">{r.label}</span>
              <div className="relative h-4">
                <span className="absolute inset-y-[-4px] left-1/2 w-px bg-ink-3" />
                {r.value !== 0 && (
                  <span
                    className={`absolute inset-y-0 ${r.value > 0 ? "rounded-r-[4px] bg-series-1" : "rounded-l-[4px] bg-negative"}`}
                    style={r.value > 0 ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }}
                  />
                )}
                <span
                  className="tabular absolute top-1/2 -translate-y-1/2 text-xs font-medium"
                  style={
                    r.value >= 0
                      ? { left: `calc(50% + ${pct}% + 6px)` }
                      : { right: `calc(50% + ${pct}% + 6px)` }
                  }
                >
                  {r.value > 0 ? `+${r.value}` : r.value}
                </span>
              </div>
              {r.tooltip && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-36 top-5 z-10 hidden w-max rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg group-hover:block"
                >
                  {r.tooltip}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
