import { getControlTower } from "@/lib/controlTower";
import { ROUTING } from "@/config/routing";
import { ActionBadge } from "@/components/badges";
import { Callout, Card, Kpi, PageHeader, table } from "@/components/ui";

export default function ActionsPage() {
  const { actionQueue, discrepancies } = getControlTower();
  const total = actionQueue.reduce((n, q) => n + q.items.length, 0);
  const auto = discrepancies.filter((d) => d.status === "Auto-resolved").length;

  return (
    <>
      <PageHeader
        title="Action Queue"
        description="What each scheduled reconciliation run sends, grouped by who has to act. Auto-resolvable items are fixed silently and logged; the rest are routed."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Action items" value={total} status={total ? "warning" : "good"} />
        <Kpi label="Owners notified" value={actionQueue.length} />
        <Kpi label="Auto-resolved this run" value={auto} status="good" />
        <Kpi label="Schedule" value={<span className="text-lg">{ROUTING.schedule.label}</span>} hint={<code>{ROUTING.schedule.cron}</code>} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Callout title="How the run is triggered">
          <code className="rounded bg-surface-2 px-1">GET /api/reconcile</code> reruns detection and returns this queue
          as JSON. Vercel Cron calls it on the schedule in <code className="rounded bg-surface-2 px-1">vercel.json</code>;
          an agent like Devin can call it daily or weekly and post each owner&apos;s items to their channel.
        </Callout>
        <Callout title="Who owns what">
          Routing lives in <code className="rounded bg-surface-2 px-1">config/routing.ts</code>. Stalls in{" "}
          {ROUTING.hiringManagerStages.join(" or ")} go to the hiring manager; earlier stages go to recruiting. Change
          owners or channels there without touching detection logic.
        </Callout>
      </div>

      <div className="mt-6 space-y-6">
        {actionQueue.map((q) => (
          <Card
            key={q.owner}
            title={q.owner}
            subtitle={<>{q.ownerRole} · {q.channel} · {q.items.length} item{q.items.length === 1 ? "" : "s"}</>}
            flush
          >
            <div className={table.wrap}>
              <table className={table.table}>
                <tbody>
                  {q.items.map((i) => (
                    <tr key={i.id} className={table.tr}>
                      <td className={`${table.td} w-52`}><ActionBadge action={i.action} /></td>
                      <td className={`${table.td} whitespace-nowrap`}>
                        <p className="font-medium">{i.subjectName}</p>
                        <p className="text-xs text-ink-3">{i.subjectId}</p>
                      </td>
                      <td className={`${table.td} text-ink-2`}>{i.message}</td>
                      <td className={`${table.td} whitespace-nowrap text-xs text-ink-3`}>{i.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
