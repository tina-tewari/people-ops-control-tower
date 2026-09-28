import { getControlTower } from "@/lib/controlTower";
import { formatPct } from "@/lib/format";
import { median } from "@/lib/metrics/stats";
import { departmentFlows, monthlyHiresAndTerminations } from "@/lib/metrics/workforce";
import { BarChart } from "@/components/charts/BarChart";
import { DivergingBars } from "@/components/charts/DivergingBars";
import { LineChart } from "@/components/charts/LineChart";
import { Card, Kpi, PageHeader, table } from "@/components/ui";

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

const REASONS = [
  { key: "voluntary", name: "Voluntary", color: "var(--series-1)" },
  { key: "involuntary", name: "Involuntary", color: "var(--series-2)" },
  { key: "layoff", name: "Layoff", color: "var(--series-3)" },
  { key: "unknownReason", name: "Reason missing", color: "var(--ink-3)" },
] as const;

export default function WorkforcePage() {
  const { dataset } = getControlTower();
  const months = monthlyHiresAndTerminations(dataset);
  const flows = departmentFlows(dataset);
  const terms = dataset.events.filter((e) => e.eventType === "Termination");
  const hires = dataset.events.filter((e) => e.eventType === "Hire").length;
  const voluntary = terms.filter((e) => e.terminationReason === "Voluntary").length;
  const earlyExits = terms.filter((e) => (e.tenureMonths ?? Infinity) < 12).length;

  return (
    <>
      <PageHeader
        title="Workforce Trends"
        description="Hires, terminations and transfers from people events: where headcount is growing, where it is leaking, and why people leave."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Hires" value={hires} hint="People events, trailing 12 months" />
        <Kpi label="Terminations" value={terms.length} hint={`Net ${hires - terms.length >= 0 ? "+" : ""}${hires - terms.length}`} />
        <Kpi label="Voluntary share" value={formatPct(terms.length ? voluntary / terms.length : null)} hint={`${voluntary} of ${terms.length} terminations`} />
        <Kpi
          label="Left within 12 months"
          value={formatPct(terms.length ? earlyExits / terms.length : null)}
          hint={`Median tenure at exit ${median(terms.map((t) => t.tenureMonths)) ?? "—"} months`}
          status={earlyExits / Math.max(1, terms.length) > 0.5 ? "warning" : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Hires vs. terminations" subtitle="By month">
          <LineChart
            labels={months.map((m) => monthLabel(m.month))}
            series={[
              { name: "Hires", color: "var(--series-1)", values: months.map((m) => m.hires) },
              { name: "Terminations", color: "var(--series-2)", values: months.map((m) => m.terminations) },
            ]}
          />
        </Card>
        <Card title="Net headcount change by department" subtitle="Hires + transfers in − terminations − transfers out">
          <DivergingBars
            positiveLabel="Net growth"
            negativeLabel="Net loss"
            rows={flows.map((f) => ({
              label: f.department,
              value: f.net,
              tooltip: (
                <>
                  <span className="font-medium">{f.department}</span>
                  <span className="mt-1 block text-ink-2">
                    +{f.hires} hires · +{f.transfersIn} in · −{f.terminations} terms · −{f.transfersOut} out
                  </span>
                </>
              ),
            }))}
          />
        </Card>
      </div>

      <Card className="mt-6" title="Terminations by department and reason" subtitle="Blank reasons are routed to HRIS by the reconciliation playbook">
        <BarChart
          series={REASONS.map((r) => ({ name: r.name, color: r.color }))}
          rows={flows
            .filter((f) => f.terminations > 0)
            .toSorted((a, b) => b.terminations - a.terminations)
            .map((f) => ({
              label: f.department,
              values: REASONS.map((r) => f[r.key]),
              tooltip: (
                <>
                  <span className="font-medium">{f.department} · {f.terminations} terminations</span>
                  {REASONS.map((r) => (
                    <span key={r.key} className="mt-1 block text-ink-2">{r.name}: {f[r.key]}</span>
                  ))}
                </>
              ),
            }))}
        />
      </Card>

      <Card className="mt-6" title="Department flows" subtitle="Table view of the charts above" flush>
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Department</th>
                <th className={table.thNum}>Hires</th>
                <th className={table.thNum}>Transfers in</th>
                <th className={table.thNum}>Terminations</th>
                <th className={table.thNum}>Transfers out</th>
                <th className={table.thNum}>Net</th>
                {REASONS.map((r) => <th key={r.key} className={table.thNum}>{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.department} className={table.tr}>
                  <td className={`${table.td} font-medium`}>{f.department}</td>
                  <td className={table.tdNum}>{f.hires}</td>
                  <td className={table.tdNum}>{f.transfersIn}</td>
                  <td className={table.tdNum}>{f.terminations}</td>
                  <td className={table.tdNum}>{f.transfersOut}</td>
                  <td className={`${table.tdNum} font-semibold`}>{f.net > 0 ? `+${f.net}` : f.net}</td>
                  {REASONS.map((r) => <td key={r.key} className={table.tdNum}>{f[r.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
