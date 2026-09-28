import Link from "next/link";
import { getControlTower } from "@/lib/controlTower";
import { formatPct } from "@/lib/format";
import { STALLED_DAYS } from "@/lib/metrics/thresholds";
import { headcountByDepartment } from "@/lib/metrics/departments";
import { monthlyHiresAndTerminations } from "@/lib/metrics/workforce";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Card, Kpi, PageHeader, StatusIcon } from "@/components/ui";

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

export default function OverviewPage() {
  const { dataset, kpis, discrepancies, actionQueue, findings, timing } = getControlTower();
  const departments = headcountByDepartment(dataset);
  const months = monthlyHiresAndTerminations(dataset);

  const byCategory = Object.entries(
    discrepancies.reduce<Record<string, { auto: number; review: number }>>((acc, d) => {
      const c = (acc[d.category] ??= { auto: 0, review: 0 });
      if (d.status === "Auto-resolved") c.auto++;
      else c.review++;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].auto + b[1].review - (a[1].auto + a[1].review));

  return (
    <>
      <PageHeader
        title="Executive Overview"
        description="Headcount, recruiting and offer data reconciled across systems. Click any number or chart row to see the records behind it."
      />

      <section aria-label="Key findings" className="grid gap-3 md:grid-cols-2">
        {findings.map((f, i) => (
          <Link
            key={f.headline}
            href={f.href}
            className={`flex gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent ${
              i === findings.length - 1 && findings.length % 2 ? "md:col-span-2" : ""
            }`}
          >
            <span className="pt-0.5"><StatusIcon tone={f.tone} /></span>
            <span>
              <span className="block text-sm font-semibold">{f.headline}</span>
              <span className="mt-1 block text-xs text-ink-2">{f.detail}</span>
            </span>
          </Link>
        ))}
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Approved headcount" value={kpis.approvedHeadcount} href="/headcount" />
        <Kpi
          label="Open headcount"
          value={kpis.openHeadcount}
          hint={`${formatPct(kpis.approvedHeadcount ? kpis.openHeadcount / kpis.approvedHeadcount : null)} of plan · ${kpis.filledHeadcount} filled`}
          href="/headcount"
        />
        <Kpi label="Active candidates" value={kpis.activeCandidates} href="/recruiting" />
        <Kpi
          label="Stalled candidates"
          value={kpis.stalledCandidates}
          hint={`> ${STALLED_DAYS} days in current stage`}
          status={kpis.stalledCandidates ? "warning" : "good"}
          href="/recruiting?stalled=1"
        />
        <Kpi
          label="Offer acceptance rate"
          value={formatPct(kpis.offerAcceptanceRate)}
          hint={`${kpis.offersAccepted} of ${kpis.offersDecided} decided (offer log) · ${kpis.offersUnderStatusReview} under status review`}
          href="/offers"
        />
        <Kpi
          label="Offer decision time"
          value={timing.offerDecisionDays != null ? `${timing.offerDecisionDays} d` : "—"}
          hint="Median, offer extended → decision"
          href="/data-model#metric-dictionary"
        />
        <Kpi
          label="Recruiting cycle time"
          value={timing.recruitingCycleDays != null ? `${timing.recruitingCycleDays} d` : "—"}
          hint={`Median, applied → offer close (${timing.hiredCount} hires)`}
          href="/data-model#metric-dictionary"
        />
        <Kpi
          label="Unresolved discrepancies"
          value={kpis.unresolvedDiscrepancies}
          hint={`${kpis.autoResolvedDiscrepancies} auto-resolved · ${actionQueue.length} owners notified`}
          status={kpis.unresolvedDiscrepancies ? "critical" : "good"}
          href="/reconciliation?view=review"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Headcount plan by department" subtitle="Filled vs. open approved seats, most open first">
          <BarChart
            series={[
              { name: "Filled", color: "var(--series-1)" },
              { name: "Open", color: "var(--series-2)" },
            ]}
            rows={departments.map((d) => ({
              label: d.department,
              values: [d.filled, d.open],
              valueLabel: `${d.open} open`,
              href: "/headcount",
              tooltip: (
                <>
                  <span className="font-medium">{d.department}</span>
                  <span className="mt-1 block text-ink-2">
                    {d.approved} approved · {d.filled} filled · {d.open} open ({formatPct(d.open / d.approved)})
                  </span>
                  {d.openHighPriority > 0 && (
                    <span className="block text-ink-2">{d.openHighPriority} open seats are High priority</span>
                  )}
                </>
              ),
            }))}
          />
        </Card>

        <Card title="Hires vs. terminations" subtitle="People events by month">
          <LineChart
            labels={months.map((m) => monthLabel(m.month))}
            series={[
              { name: "Hires", color: "var(--series-1)", values: months.map((m) => m.hires) },
              { name: "Terminations", color: "var(--series-2)", values: months.map((m) => m.terminations) },
            ]}
          />
        </Card>
      </div>

      <Card
        className="mt-6"
        title="Discrepancies by category"
        subtitle="Auto-resolved by the playbook vs. routed to an owner"
        action={<Link href="/reconciliation" className="text-xs font-medium text-accent">Open queue →</Link>}
      >
        <BarChart
          labelWidth="10rem"
          series={[
            { name: "Auto-resolved", color: "var(--series-1)" },
            { name: "Needs review", color: "var(--series-2)" },
          ]}
          rows={byCategory.map(([category, c]) => ({
            label: category,
            values: [c.auto, c.review],
            href: "/reconciliation",
            tooltip: (
              <>
                <span className="font-medium">{category}</span>
                <span className="mt-1 block text-ink-2">{c.auto} auto-resolved · {c.review} need review</span>
              </>
            ),
          }))}
        />
      </Card>
    </>
  );
}
