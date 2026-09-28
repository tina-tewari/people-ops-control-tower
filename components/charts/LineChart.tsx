"use client";

// Multi-series line chart with a crosshair tooltip. One y-axis; x is categorical (months).

import { useState } from "react";

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

const W = 640;
const H = 220;
const PAD = { top: 12, right: 72, bottom: 24, left: 32 };

/** `labels` are display-ready strings (functions can't cross the server/client boundary). */
export function LineChart({ labels, series }: { labels: string[]; series: LineSeries[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = Math.ceil(max / 5) * 5;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;
  const ticks = [0, niceMax / 2, niceMax];

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * innerW;
    const i = Math.round((px / innerW) * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  }

  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.name).join(" and ") + " by month"}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--ink-3)">{t}</text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1 ? (
              <text key={l} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{l}</text>
            ) : null,
          )}
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--ink-3)" strokeDasharray="3 3" />
          )}
          {series.map((s) => (
            <g key={s.name}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              />
              <text
                x={x(s.values.length - 1) + 8}
                y={y(s.values.at(-1) ?? 0)}
                dy="0.32em"
                fontSize="11"
                fill="var(--ink-2)"
              >
                {s.name}
              </text>
              {hover != null && (
                <circle cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
              )}
            </g>
          ))}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: x(hover) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <p className="font-medium">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.name} className="mt-1 flex items-center gap-2 text-ink-2">
                <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                {s.name}
                <span className="tabular ml-auto pl-3 font-medium text-ink">{s.values[hover]}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
