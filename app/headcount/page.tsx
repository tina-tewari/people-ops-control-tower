import Link from "next/link";
import { getControlTower } from "@/lib/controlTower";
import { formatDate, formatRatio } from "@/lib/format";
import { COVERAGE_AT_RISK, COVERAGE_HEALTHY } from "@/lib/metrics/thresholds";
import type { RiskStatus } from "@/lib/metrics/headcount";
import { PriorityText, RiskBadge } from "@/components/badges";
import { BarChart } from "@/components/charts/BarChart";
import { Card, FilterBar, InferredTag, Kpi, PageHeader, table } from "@/components/ui";

const FILTERS: (RiskStatus | "All")[] = ["All", "Critical", "At Risk", "Healthy"];

export default async function HeadcountPage({ searchParams }: PageProps<"/headcount">) {
  const { risk = "All" } = (await searchParams) as { risk?: string };
  const { headcountRisk, dataset } = getControlTower();
  const rows = risk === "All" ? headcountRisk : headcountRisk.filter((r) => r.risk === risk);
  const count = (s: RiskStatus) => headcountRisk.filter((r) => r.risk === s).length;
  const flagged = headcountRisk.filter((r) => r.flags.some((f) => f.startsWith("High priority")));
  const RISK_COLOR = { Critical: "var(--critical)", "At Risk": "var(--warning)", Healthy: "var(--good)" };
  const openRows = headcountRisk
    .filter((r) => r.open > 0)
    .toSorted((a, b) => (a.coverage ?? 0) - (b.coverage ?? 0));
  const highRows = openRows.filter((r) => r.priority === "High");

  return (
    <>
      <PageHeader
        title="Headcount Risk"
        description={
          <>
            Approved plan vs. filled seats vs. active recruiting pipeline, by department and level. Coverage is
            active candidates per open seat: ≥ {COVERAGE_HEALTHY}× Healthy, ≥ {COVERAGE_AT_RISK}× At Risk, below
            that Critical.
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Critical" value={count("Critical")} status="critical" href="/headcount?risk=Critical" />
        <Kpi label="At Risk" value={count("At Risk")} status="warning" href="/headcount?risk=At%20Risk" />
        <Kpi label="Healthy" value={count("Healthy")} status="good" href="/headcount?risk=Healthy" />
        <Kpi
          label="High priority, under-covered"
          value={flagged.length}
          hint={`${flagged.reduce((n, r) => n + r.open, 0)} open seats`}
          status={flagged.length ? "critical" : "good"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Coverage: high-priority openings" subtitle="Active candidates per open seat. Dashed lines mark the At Risk and Healthy thresholds.">
          <CoverageChart rows={highRows} colors={RISK_COLOR} />
        </Card>
        <Card title="Coverage: all other openings" subtitle="Medium and Low priority">
          <CoverageChart rows={openRows.filter((r) => r.priority !== "High")} colors={RISK_COLOR} />
        </Card>
      </div>

      <Card
        className="mt-6"
        title="Seats by department and level"
        subtitle={<>Sorted by risk, then priority. Data as of {formatDate(dataset.meta.asOf)}.</>}
        action={
          <FilterBar
            active={risk}
            options={FILTERS.map((f) => ({
              key: f,
              label: f,
              href: f === "All" ? "/headcount" : `/headcount?risk=${encodeURIComponent(f)}`,
            }))}
          />
        }
        flush
      >
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Department</th>
                <th className={table.th}>Level</th>
                <th className={table.thNum}>Approved</th>
                <th className={table.thNum}>Filled</th>
                <th className={table.thNum}>Open</th>
                <th className={table.th}>Priority</th>
                <th className={table.th}>Target start</th>
                <th className={table.thNum}>
                  <span className="inline-flex items-center gap-1.5">Active pipeline <InferredTag /></span>
                </th>
                <th className={table.thNum}>Coverage</th>
                <th className={table.th}>Risk</th>
                <th className={table.th}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const highFlag = r.flags.some((f) => f.startsWith("High priority"));
                return (
                  <tr key={r.reqId} className={`${table.tr} ${highFlag ? "bg-critical/5" : ""}`}>
                    <td className={`${table.td} font-medium`}>{r.department}</td>
                    <td className={table.td}>{r.level}</td>
                    <td className={table.tdNum}>{r.approved}</td>
                    <td className={table.tdNum}>{r.filled}</td>
                    <td className={table.tdNum}>{r.open}</td>
                    <td className={table.td}><PriorityText priority={r.priority} /></td>
                    <td className={`${table.td} whitespace-nowrap`}>{formatDate(r.targetStartDate)}</td>
                    <td className={table.tdNum}>
                      <Link href={`/data-model#${r.reqId}`} className="underline decoration-line underline-offset-4 hover:decoration-accent">
                        {r.activePipeline}
                      </Link>
                    </td>
                    <td className={table.tdNum}>{r.open ? formatRatio(r.coverage) : "—"}</td>
                    <td className={table.td}><RiskBadge risk={r.risk} /></td>
                    <td className={`${table.td} text-xs text-ink-2`}>
                      {r.flags.length ? r.flags.map((f) => <p key={f} className={f.startsWith("High") ? "font-medium text-ink" : ""}>{f}</p>) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-ink-3">
        Pipeline counts link headcount to candidates on department + level because no shared req_id exists.{" "}
        <Link href="/data-model" className="text-accent">See the data model gap →</Link>
      </p>
    </>
  );
}

function CoverageChart({
  rows,
  colors,
}: {
  rows: ReturnType<typeof getControlTower>["headcountRisk"];
  colors: Record<RiskStatus, string>;
}) {
  return (
    <BarChart
      labelWidth="12.5rem"
      series={[{ name: "Coverage", color: "var(--series-1)" }]}
      legend={(["Critical", "At Risk", "Healthy"] as const).map((s) => ({ name: s, color: colors[s] }))}
      markers={[
        { value: COVERAGE_AT_RISK, label: `${COVERAGE_AT_RISK}×` },
        { value: COVERAGE_HEALTHY, label: `${COVERAGE_HEALTHY}×` },
      ]}
      rows={rows.map((r) => ({
        label: `${r.department} ${r.level}`,
        sublabel: `${r.open} open`,
        values: [r.coverage ?? 0],
        color: colors[r.risk],
        valueLabel: formatRatio(r.coverage),
        href: `/data-model#${r.reqId}`,
        tooltip: (
          <>
            <span className="font-medium">{r.department} {r.level} · {r.risk}</span>
            <span className="mt-1 block text-ink-2">
              {r.activePipeline} active candidates for {r.open} open seats ({r.priority} priority)
            </span>
            {r.flags.map((f) => <span key={f} className="block text-ink-2">{f}</span>)}
          </>
        ),
      }))}
    />
  );
}
