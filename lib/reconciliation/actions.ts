// The action queue: what a scheduled run sends, grouped by who must act.
// Sources: discrepancies that need a human (including hiring-manager stalls),
// plus candidates stalled in recruiter-owned stages.

import type { Dataset } from "@/lib/types";
import { ROUTING, channelFor, type OwnerRole } from "@/config/routing";
import { activeCandidates, isStalled } from "@/lib/metrics/recruiting";
import { STALLED_DAYS } from "@/lib/metrics/thresholds";
import type { Discrepancy } from "./discrepancies";
import type { SystemAction } from "./playbook";

export interface ActionItem {
  id: string;
  action: SystemAction;
  ownerRole: OwnerRole;
  owner: string;
  channel: string;
  subjectId: string;
  subjectName: string;
  message: string;
  source: "Discrepancy" | "Stalled candidate";
}

export interface OwnerQueue {
  owner: string;
  ownerRole: OwnerRole;
  channel: string;
  items: ActionItem[];
}

/** Hiring-manager-stage stalls are detected as discrepancies (stalledHiringManagerStage). */
function stalledCandidateActions(ds: Dataset): ActionItem[] {
  const hmStages = new Set(ROUTING.hiringManagerStages);
  return activeCandidates(ds.pipeline)
    .filter((p) => isStalled(p) && !hmStages.has(p.currentStage))
    .map((p) => {
      const ownerRole: OwnerRole = "Recruiting Ops";
      const owner = ROUTING.recruiterByDepartment[p.department] ?? "Recruiting Ops";
      return {
        id: `stalled:${p.candidateId}`,
        action: "Ping owner",
        ownerRole,
        owner,
        channel: channelFor(ownerRole),
        subjectId: p.candidateId,
        subjectName: p.candidateName,
        message: `${p.candidateName} (${p.role}, ${p.level}) has been in ${p.currentStage} for ${p.daysInCurrentStage} days.`,
        source: "Stalled candidate",
      };
    });
}

function discrepancyActions(discrepancies: Discrepancy[]): ActionItem[] {
  return discrepancies
    .filter((d) => d.status === "Needs review")
    .map((d) => ({
      id: d.id,
      action: d.action,
      ownerRole: d.ownerRole,
      owner: d.owner,
      channel: channelFor(d.ownerRole),
      subjectId: d.subjectId,
      subjectName: d.subjectName,
      message:
        d.rule === "stalledHiringManagerStage"
          ? `${d.subjectName}: ${d.sourceA.value} (threshold ${STALLED_DAYS}). ${d.basis}`
          : `${d.field}: ${d.sourceA.system} says "${d.sourceA.value}", ${d.sourceB.system} says "${d.sourceB.value}".`,
      source: d.rule === "stalledHiringManagerStage" ? "Stalled candidate" : "Discrepancy",
    }));
}

export function buildActionQueue(ds: Dataset, discrepancies: Discrepancy[]): OwnerQueue[] {
  const items = [...discrepancyActions(discrepancies), ...stalledCandidateActions(ds)];
  const byOwner = new Map<string, OwnerQueue>();
  for (const item of items) {
    const q = byOwner.get(item.owner) ?? {
      owner: item.owner,
      ownerRole: item.ownerRole,
      channel: item.channel,
      items: [],
    };
    q.items.push(item);
    byOwner.set(item.owner, q);
  }
  return [...byOwner.values()].sort((a, b) => b.items.length - a.items.length);
}
