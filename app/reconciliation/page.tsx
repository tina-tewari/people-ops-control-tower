import { getControlTower } from "@/lib/controlTower";
import { FIELD_POLICIES } from "@/lib/reconciliation/sourceOfTruth";
import { PLAYBOOK_ORDER, RULES, resolutionFor } from "@/lib/reconciliation/playbook";
import { runReconciliation } from "@/lib/reconciliation/job";
import type { ResultStatus } from "@/lib/reconciliation/results";
import { ActionBadge, ResolutionBadge } from "@/components/badges";
import { Card, FilterBar, Kpi, PageHeader, Pill, table } from "@/components/ui";

const STATUS_LABEL: Record<ResultStatus, string> = {
  auto_resolved: "Auto-resolved",
  needs_review: "Needs review",
  resolved: "Resolved",
  ignored: "Ignored",
};

const VIEWS = { all: "All", review: "B · Human review", auto: "A · Auto-resolvable" } as const;

export default async function ReconciliationPage({ searchParams }: PageProps<"/reconciliation">) {
  const { view = "all" } = (await searchParams) as { view?: keyof typeof VIEWS };
  const { discrepancies } = getControlTower();
  const statusById = new Map(runReconciliation().results.map((r) => [r.id, r.status]));

  const review = discrepancies.filter((d) => d.resolution === "Human review");
  const auto = discrepancies.filter((d) => d.resolution === "Auto-resolvable");
  const rows = view === "review" ? review : view === "auto" ? auto : discrepancies;
  const hitsByRule = discrepancies.reduce<Record<string, number>>((acc, d) => {
    acc[d.rule] = (acc[d.rule] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Data Reconciliation"
        description="Conflicts detected across the recruiting pipeline, offer log, offer letters, people events and headcount plan. Each conflict type maps to one system action."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Discrepancies detected" value={discrepancies.length} />
        <Kpi label="A · Auto-resolved" value={auto.length} status="good" href="/reconciliation?view=auto" />
        <Kpi label="B · Needs human review" value={review.length} status={review.length ? "critical" : "good"} href="/reconciliation?view=review" />
        <Kpi label="Records affected" value={new Set(discrepancies.map((d) => d.subjectId)).size} />
      </div>

      <Card className="mt-6" title="Reconciliation playbook" subtitle="Conflict → what the system does. Rules live in lib/reconciliation/playbook.ts" flush>
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Conflict</th>
                <th className={table.th}>What the system does</th>
                <th className={table.th}>Class</th>
                <th className={table.th}>Owner</th>
                <th className={table.thNum}>Hits</th>
              </tr>
            </thead>
            <tbody>
              {PLAYBOOK_ORDER.map((id) => {
                const r = RULES[id];
                return (
                  <tr key={id} className={`${table.tr} ${hitsByRule[id] ? "" : "text-ink-3"}`}>
                    <td className={table.td}>{r.conflict}</td>
                    <td className={table.td}><ActionBadge action={r.action} /></td>
                    <td className={table.td}><ResolutionBadge resolution={resolutionFor(r.action)} /></td>
                    <td className={`${table.td} whitespace-nowrap`}>{r.ownerRole}</td>
                    <td className={table.tdNum}>{hitsByRule[id] ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6" title="Source-of-truth hierarchy" subtitle="Highest authority first. A deterministic value is applied only when a second source corroborates it." flush>
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Field</th>
                <th className={table.th}>Hierarchy</th>
                <th className={table.th}>Mode</th>
                <th className={table.th}>Rule</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_POLICIES.map((p) => (
                <tr key={p.label} className={table.tr}>
                  <td className={`${table.td} font-medium`}>{p.label}</td>
                  <td className={table.td}>
                    <ol className="flex flex-wrap items-center gap-1 text-xs">
                      {p.hierarchy.map((s, i) => (
                        <li key={s} className="flex items-center gap-1">
                          {i > 0 && <span className="text-ink-3">›</span>}
                          <span className="whitespace-nowrap rounded bg-surface-2 px-1.5 py-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </td>
                  <td className={table.td}>
                    <Pill tone={p.mode === "Deterministic" ? "good" : "serious"}>{p.mode}</Pill>
                  </td>
                  <td className={`${table.td} text-ink-2`}>{p.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        className="mt-6"
        title="Discrepancy queue"
        subtitle="Human review first"
        action={
          <FilterBar
            active={view}
            options={[
              { key: "all", label: VIEWS.all, href: "/reconciliation", count: discrepancies.length },
              { key: "review", label: VIEWS.review, href: "/reconciliation?view=review", count: review.length },
              { key: "auto", label: VIEWS.auto, href: "/reconciliation?view=auto", count: auto.length },
            ]}
          />
        }
        flush
      >
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Candidate / subject</th>
                <th className={table.th}>Field</th>
                <th className={table.th}>Source A</th>
                <th className={table.th}>Source B</th>
                <th className={table.th}>Recommended</th>
                <th className={table.th}>System action</th>
                <th className={table.th}>Owner</th>
                <th className={table.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={table.tr}>
                  <td className={table.td}>
                    <p className="font-medium">{d.subjectName}</p>
                    <p className="text-xs text-ink-3">{d.subjectId} · {d.category}</p>
                  </td>
                  <td className={`${table.td} whitespace-nowrap`}>{d.field}</td>
                  <td className={table.td}>
                    <p className="text-xs text-ink-3">{d.sourceA.system}</p>
                    <p>{d.sourceA.value}</p>
                  </td>
                  <td className={table.td}>
                    <p className="text-xs text-ink-3">{d.sourceB.system}</p>
                    <p>{d.sourceB.value}</p>
                  </td>
                  <td className={table.td}>
                    {d.recommended ? <p className="font-medium">{d.recommended}</p> : <p className="text-ink-3">—</p>}
                    <p className="mt-0.5 max-w-64 text-xs text-ink-3">{d.basis}</p>
                  </td>
                  <td className={table.td}><ActionBadge action={d.action} /></td>
                  <td className={`${table.td} whitespace-nowrap`}>{d.owner}</td>
                  <td className={table.td}>
                    {(() => {
                      const status = statusById.get(d.id) ?? "needs_review";
                      return <Pill tone={status === "needs_review" ? "serious" : "good"}>{STATUS_LABEL[status]}</Pill>;
                    })()}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-3">Nothing in this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
