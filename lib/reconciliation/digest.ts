// Slack digest for a reconciliation run: headline counts, then which hiring
// managers need to act on which candidates, then team review queues.

import { ROUTING, channelFor, type OwnerRole } from "@/config/routing";
import type { ReconciliationRun } from "./job";
import { RULES } from "./playbook";

const TEAM_ROLES = Object.keys(ROUTING.channels).filter((r) => r !== "Hiring manager") as OwnerRole[];

export function slackDigest(run: ReconciliationRun, opts: { maxItemsPerManager?: number } = {}): string {
  const max = opts.maxItemsPerManager ?? 10;
  const s = run.summary;
  const lines = [
    `*People Ops reconciliation — ${run.ran_at.slice(0, 10)}* (${run.dataset.label}, as of ${run.dataset.asOf})`,
    `${s.total_conflicts} conflicts · ${s.auto_resolved} auto-resolved · ${s.needs_review} need review · ${s.resolved} resolved · ${s.ignored} ignored`,
    "",
  ];

  const hms = run.hiring_manager_approvals;
  if (hms.length) {
    lines.push(`*Hiring managers — approvals needed (${hms.reduce((n, h) => n + h.items.length, 0)})*`);
    for (const hm of hms) {
      lines.push(`• *${hm.hiring_manager}* — ${hm.items.length} candidate${hm.items.length === 1 ? "" : "s"} to advance or reject:`);
      for (const i of hm.items.slice(0, max)) {
        lines.push(`    ◦ ${i.candidate_name} (${i.candidate_id}): ${i.ask}`);
      }
      if (hm.items.length > max) lines.push(`    ◦ …and ${hm.items.length - max} more`);
    }
  } else {
    lines.push("*Hiring managers* — nothing waiting on approval.");
  }

  const open = run.results.filter((r) => r.status === "needs_review");
  const teamLines = TEAM_ROLES.flatMap((role) => {
    const mine = open.filter((r) => r.owner === role);
    if (!mine.length) return [];
    const byType = Object.entries(
      mine.reduce<Record<string, number>>((acc, r) => {
        acc[r.conflict_type] = (acc[r.conflict_type] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${RULES[t as keyof typeof RULES].conflict} (${n})`);
    return [`• *${role}* (${channelFor(role)}) — ${mine.length}: ${byType.join("; ")}`];
  });
  if (teamLines.length) lines.push("", "*Team review queues*", ...teamLines);

  return lines.join("\n");
}

/** Posts to a Slack incoming webhook when one is configured; no-op otherwise. */
export async function postSlackDigest(text: string, webhook = process.env.SLACK_WEBHOOK_URL): Promise<boolean> {
  if (!webhook) return false;
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  return true;
}
