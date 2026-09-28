// Scheduled reconciliation run. Triggered by Vercel Cron (see vercel.json) or by
// an agent such as Devin on the weekly schedule. Returns the run report:
// what was auto-resolved and the per-owner queue of items needing a human.

import { getControlTower } from "@/lib/controlTower";
import { ROUTING } from "@/config/routing";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  // When CRON_SECRET is set, Vercel Cron sends it as a bearer token.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dataset, discrepancies, actionQueue } = getControlTower();
  const autoResolved = discrepancies.filter((d) => d.status === "Auto-resolved");

  return Response.json({
    ranAt: new Date().toISOString(),
    schedule: ROUTING.schedule,
    dataset: dataset.meta,
    summary: {
      discrepancies: discrepancies.length,
      autoResolved: autoResolved.length,
      needsReview: discrepancies.length - autoResolved.length,
      actionItems: actionQueue.reduce((n, q) => n + q.items.length, 0),
    },
    autoResolved: autoResolved.map((d) => ({
      rule: d.rule,
      subject: d.subjectId,
      field: d.field,
      from: d.sourceA,
      to: d.recommended,
      basis: d.basis,
    })),
    notifications: actionQueue.map((q) => ({
      owner: q.owner,
      channel: q.channel,
      count: q.items.length,
      items: q.items.map((i) => ({ id: i.id, action: i.action, subject: i.subjectId, message: i.message })),
    })),
  });
}
