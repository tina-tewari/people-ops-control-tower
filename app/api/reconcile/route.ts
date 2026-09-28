// Scheduled entry point (Vercel Cron, see vercel.json). Runs the reconciliation
// job, persists status history, and posts the Slack digest if a webhook is set.
// Protected by CRON_SECRET when that env var is set.

import { getControlTower } from "@/lib/controlTower";
import { unauthorized } from "@/lib/reconciliation/auth";
import { postSlackDigest, slackDigest } from "@/lib/reconciliation/digest";
import { runReconciliation } from "@/lib/reconciliation/job";

async function handle(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const run = runReconciliation({ persist: true });
  const slackPosted = await postSlackDigest(slackDigest(run));
  const { actionQueue } = getControlTower();

  return Response.json({
    ...run,
    slack_posted: slackPosted,
    notifications: actionQueue.map((q) => ({
      owner: q.owner,
      channel: q.channel,
      count: q.items.length,
      items: q.items.map((i) => ({ id: i.id, action: i.action, subject: i.subjectId, message: i.message })),
    })),
  });
}

export const GET = handle;
export const POST = handle;
