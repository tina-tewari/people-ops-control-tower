// Weekly scheduled entry point (Vercel Cron, see vercel.json). Runs the reconciliation
// job, persists status history, and posts the Slack digest if a webhook is set.
// Protected by CRON_SECRET when that env var is set.

import { getControlTower } from "@/lib/controlTower";
import { unauthorized } from "@/lib/reconciliation/auth";
import { postSlackDigest, slackDigest } from "@/lib/reconciliation/digest";
import { runReconciliation } from "@/lib/reconciliation/job";
import { HUMAN_STATUSES } from "@/lib/reconciliation/store";

async function handle(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const run = runReconciliation({ persist: true });
  const slackPosted = await postSlackDigest(slackDigest(run));
  const { actionQueue } = getControlTower();
  const handled = new Set(run.results.filter((r) => HUMAN_STATUSES.has(r.status)).map((r) => r.id));
  const openQueues = actionQueue
    .map((q) => ({ ...q, items: q.items.filter((i) => !handled.has(i.id)) }))
    .filter((q) => q.items.length > 0);

  return Response.json({
    ...run,
    slack_posted: slackPosted,
    notifications: openQueues.map((q) => ({
      owner: q.owner,
      channel: q.channel,
      count: q.items.length,
      items: q.items.map((i) => ({ id: i.id, action: i.action, subject: i.subjectId, message: i.message })),
    })),
  });
}

export const GET = handle;
export const POST = handle;
