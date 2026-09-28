import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-ink-2">{description}</p>
      </div>
      {children}
    </header>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  flush = false,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove body padding (for edge-to-edge tables). */
  flush?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  href,
  status,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  status?: Tone;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
        {status && <StatusIcon tone={status} />}
        {label}
      </p>
      <p className="tabular mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-surface p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-accent`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export type Tone = "good" | "warning" | "serious" | "critical" | "neutral" | "info";

const TONE_COLOR: Record<Tone, string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  critical: "text-critical",
  neutral: "text-ink-3",
  info: "text-accent",
};

/** Shape differs per tone so status never relies on color alone. */
export function StatusIcon({ tone }: { tone: Tone }) {
  const cls = `size-3.5 shrink-0 ${TONE_COLOR[tone]}`;
  switch (tone) {
    case "good":
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M4.8 8.2l2 2 4.4-4.4" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "warning":
    case "serious":
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <path d="M8 1.5l7 12.5H1z" fill="currentColor" />
          <path d="M8 6v3.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11.8" r="0.9" fill="white" />
        </svg>
      );
    case "critical":
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <path d="M5 1h6l4 4v6l-4 4H5l-4-4V5z" fill="currentColor" />
          <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M8 7v4.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="4.8" r="0.9" fill="white" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}

/** Icon + text label; text stays in ink so the label is always legible. */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink">
      <StatusIcon tone={tone} />
      {children}
    </span>
  );
}

export function Tag({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center whitespace-nowrap rounded border border-dashed border-ink-3/60 px-1.5 py-px text-[11px] font-medium uppercase tracking-wide text-ink-2"
    >
      {children}
    </span>
  );
}

export function InferredTag() {
  return <Tag title="Linked on department + level; no shared req_id exists upstream.">Inferred</Tag>;
}

export function Callout({ tone = "info", title, children }: { tone?: Tone; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="pt-0.5">
        <StatusIcon tone={tone} />
      </div>
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        <div className="mt-1 text-ink-2">{children}</div>
      </div>
    </div>
  );
}

/** Horizontal filter chips driven by URL search params. */
export function FilterBar({
  options,
  active,
}: {
  options: { label: string; href: string; key: string; count?: number }[];
  active: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.key === active;
        return (
          <Link
            key={o.key}
            href={o.href}
            scroll={false}
            aria-current={on ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              on
                ? "border-accent bg-accent-soft text-ink"
                : "border-line bg-surface text-ink-2 hover:border-ink-3"
            }`}
          >
            {o.label}
            {o.count != null && <span className="tabular ml-1.5 text-ink-3">{o.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}

// Table styling shared across sections.
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full text-left text-sm",
  thead: "border-b border-line bg-surface-2/60 text-xs text-ink-2",
  th: "px-4 py-2.5 font-medium whitespace-nowrap",
  thNum: "px-4 py-2.5 font-medium whitespace-nowrap text-right",
  tr: "border-b border-line last:border-0",
  td: "px-4 py-3 align-top",
  tdNum: "tabular px-4 py-3 text-right align-top",
};

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-ink-3">
        {children}
      </td>
    </tr>
  );
}
