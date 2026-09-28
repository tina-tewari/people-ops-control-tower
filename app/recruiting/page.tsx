import Link from "next/link";
import { getControlTower } from "@/lib/controlTower";
import { activeCandidates, isStalled, managerSummary, stageSummary } from "@/lib/metrics/recruiting";
import { STALLED_DAYS } from "@/lib/metrics/thresholds";
import { formatPct } from "@/lib/format";
import { ROUTING } from "@/config/routing";
import { BarChart } from "@/components/charts/BarChart";
import { timeToOfferByManager } from "@/lib/metrics/timing";
import { Card, FilterBar, Kpi, PageHeader, Pill, table } from "@/components/ui";

export default async function RecruitingPage({ searchParams }: PageProps<"/recruiting">) {
  const { hm = "", stalled = "" } = (await searchParams) as { hm?: string; stalled?: string };
  const { dataset } = getControlTower();
  const active = activeCandidates(dataset.pipeline);
  const stages = stageSummary(active);
  const managers = managerSummary(active);
  const hmStages = new Set(ROUTING.hiringManagerStages);

  const rows = active.filter((p) => (!hm || p.hiringManager === hm) && (!stalled || isStalled(p)));
  const stalledCount = active.filter(isStalled).length;
  const withHm = active.filter((p) => isStalled(p) && hmStages.has(p.currentStage)).length;
  const hmTiming = timeToOfferByManager(dataset);
  const STALL_SERIES = [
    { name: "On track", color: "var(--series-1)" },
    { name: `Stalled > ${STALLED_DAYS} days`, color: "var(--serious)" },
  ];

  const href = (next: { hm?: string; stalled?: string }) => {
    const q = new URLSearchParams();
    const h = next.hm ?? hm;
    const s = next.stalled ?? stalled;
    if (h) q.set("hm", h);
    if (s) q.set("stalled", s);
    const qs = q.toString();
    return `/recruiting${qs ? `?${qs}` : ""}#candidates`;
  };

  return (
    <>
      <PageHeader
        title="Recruiting Bottlenecks"
        description={`Where active candidates are waiting, and who owns the wait. A candidate is stalled after ${STALLED_DAYS} days in one stage.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active candidates" value={active.length} />
        <Kpi
          label="Stalled"
          value={stalledCount}
          hint={formatPct(active.length ? stalledCount / active.length : null) + " of active"}
          status={stalledCount ? "warning" : "good"}
          href={href({ stalled: "1", hm: "" })}
        />
        <Kpi label="Stalled on hiring manager" value={withHm} hint="HM interview or final round" status={withHm ? "warning" : "good"} />
        <Kpi label="Hiring managers with stalls" value={managers.filter((m) => m.stalled > 0).length} hint={`of ${managers.length} with active candidates`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Active candidates by stage" subtitle="Hover a bar for stage detail">
          <BarChart
            labelWidth="11rem"
            series={STALL_SERIES}
            rows={stages.map((st) => ({
              label: st.stage,
              values: [st.count - st.stalled, st.stalled],
              tooltip: (
                <>
                  <span className="font-medium">{st.stage}</span>
                  <span className="mt-1 block text-ink-2">
                    {st.count} active · {st.stalled} stalled
                    {st.avgDays != null && ` · avg ${st.avgDays.toFixed(1)} days in stage`}
                  </span>
                </>
              ),
            }))}
          />
        </Card>
        <Card className="lg:col-span-2" title="Stage-level time" subtitle="Average days in current stage, active candidates" flush>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Stage</th>
                <th className={table.thNum}>Active</th>
                <th className={table.thNum}>Stalled</th>
                <th className={table.thNum}>Avg days</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stage} className={table.tr}>
                  <td className={table.td}>{s.stage}</td>
                  <td className={table.tdNum}>{s.count}</td>
                  <td className={table.tdNum}>{s.stalled}</td>
                  <td className={`${table.tdNum} ${s.avgDays != null && s.avgDays > STALLED_DAYS ? "font-semibold" : ""}`}>
                    {s.avgDays?.toFixed(1) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Stalled candidates by hiring manager" subtitle="Click a manager to filter the candidate list">
          <BarChart
            series={STALL_SERIES}
            rows={managers.map((m) => ({
              label: m.hiringManager,
              values: [m.active - m.stalled, m.stalled],
              valueLabel: `${m.stalled}/${m.active}`,
              href: href({ hm: m.hiringManager }),
              tooltip: (
                <>
                  <span className="font-medium">{m.hiringManager}</span>
                  <span className="mt-1 block text-ink-2">
                    {m.stalled} of {m.active} active stalled ({formatPct(m.stalledShare)}) · longest wait {m.oldestDays} days
                  </span>
                </>
              ),
            }))}
          />
        </Card>
        <Card title="Time to offer by hiring manager" subtitle="Median days from application to offer extended">
          <BarChart
            series={[{ name: "Median days to offer", color: "var(--series-1)" }]}
            rows={hmTiming.map((m) => ({
              label: m.hiringManager,
              values: [m.applyToOfferDays],
              valueLabel: `${m.applyToOfferDays} d`,
              href: href({ hm: m.hiringManager }),
              tooltip: (
                <>
                  <span className="font-medium">{m.hiringManager}</span>
                  <span className="mt-1 block text-ink-2">
                    Median {m.applyToOfferDays} days to offer across {m.hires} offer{m.hires === 1 ? "" : "s"}
                  </span>
                </>
              ),
            }))}
          />
        </Card>
      </div>

      <Card className="mt-6" title="Stalls by hiring manager" subtitle="Click a manager to filter the candidate list" flush>
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Hiring manager</th>
                <th className={table.thNum}>Active</th>
                <th className={table.thNum}>Stalled</th>
                <th className={table.thNum}>Stalled share</th>
                <th className={table.thNum}>Longest wait</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.hiringManager} className={`${table.tr} ${m.hiringManager === hm ? "bg-accent-soft" : ""}`}>
                  <td className={table.td}>
                    <Link href={href({ hm: m.hiringManager === hm ? "" : m.hiringManager })} scroll={false} className="font-medium hover:text-accent">
                      {m.hiringManager}
                    </Link>
                  </td>
                  <td className={table.tdNum}>{m.active}</td>
                  <td className={table.tdNum}>{m.stalled}</td>
                  <td className={table.tdNum}>{formatPct(m.stalledShare)}</td>
                  <td className={table.tdNum}>{m.oldestDays} d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        className="mt-6 scroll-mt-20"
        title={<span id="candidates">Active candidates{hm && ` · ${hm}`}</span>}
        subtitle="Longest wait first"
        action={
          <FilterBar
            active={stalled ? "stalled" : "all"}
            options={[
              { key: "all", label: "All active", href: href({ stalled: "" }), count: active.filter((p) => !hm || p.hiringManager === hm).length },
              { key: "stalled", label: `Stalled > ${STALLED_DAYS}d`, href: href({ stalled: "1" }), count: active.filter((p) => isStalled(p) && (!hm || p.hiringManager === hm)).length },
              ...(hm ? [{ key: "clear", label: "Clear manager ✕", href: href({ hm: "" }) }] : []),
            ]}
          />
        }
        flush
      >
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Candidate</th>
                <th className={table.th}>Role</th>
                <th className={table.th}>Stage</th>
                <th className={table.thNum}>Days in stage</th>
                <th className={table.th}>Hiring manager</th>
                <th className={table.th}>Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const st = isStalled(p);
                const onHm = hmStages.has(p.currentStage);
                return (
                  <tr key={p.candidateId} className={`${table.tr} ${st ? "bg-serious/5" : ""}`}>
                    <td className={table.td}>
                      <p className="font-medium">{p.candidateName}</p>
                      <p className="text-xs text-ink-3">{p.candidateId}</p>
                    </td>
                    <td className={table.td}>
                      {p.role}
                      <p className="text-xs text-ink-3">{p.department} · {p.level}</p>
                    </td>
                    <td className={table.td}>{p.currentStage}</td>
                    <td className={`${table.tdNum} ${st ? "font-semibold" : ""}`}>{p.daysInCurrentStage}</td>
                    <td className={table.td}>{p.hiringManager}</td>
                    <td className={table.td}>
                      {st ? (
                        <Pill tone="warning">{onHm ? `Ping ${p.hiringManager}` : "Ping recruiter"}</Pill>
                      ) : (
                        <Pill tone="good">On track</Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-3">No candidates match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
