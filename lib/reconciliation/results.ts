// Public reconciliation result schema, consumed by the dashboard and the API.
// Built from internal `Discrepancy` records plus persisted status history.

import { createHash } from "node:crypto";
import type { Discrepancy } from "./discrepancies";
import type { RuleId } from "./playbook";
import { RULES } from "./playbook";
import type { SourceSystem } from "./sourceOfTruth";

export const RESULT_STATUSES = ["auto_resolved", "needs_review", "resolved", "ignored"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export type ResultResolutionType = "deterministic_override" | "human_review";

export interface ReconciliationResult {
  id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  conflict_type: RuleId;
  field: string;
  source_a: SourceSystem;
  source_a_value: string;
  source_b: SourceSystem;
  source_b_value: string;
  reconciled_value: string | null;
  resolution_type: ResultResolutionType;
  owner: string;
  status: ResultStatus;
  detected_at: string;
  resolved_at: string | null;
  reason: string;
}

export interface ReconciliationSummary {
  total_conflicts: number;
  auto_resolved: number;
  needs_review: number;
  resolved: number;
  ignored: number;
  conflicts_by_type: Partial<Record<RuleId, number>>;
  conflicts_by_owner: Record<string, number>;
}

/** Changes whenever the conflicting values change, so a closed item can reopen. */
export function fingerprint(d: Discrepancy): string {
  return createHash("sha256")
    .update(JSON.stringify([d.sourceA, d.sourceB, d.recommended, d.owner]))
    .digest("hex")
    .slice(0, 16);
}

export function initialStatus(d: Discrepancy): ResultStatus {
  return d.status === "Auto-resolved" ? "auto_resolved" : "needs_review";
}

export function toResult(
  d: Discrepancy,
  history: { status: ResultStatus; detected_at: string; resolved_at: string | null },
): ReconciliationResult {
  const isCandidate = RULES[d.rule].subject === "candidate";
  return {
    id: d.id,
    candidate_id: isCandidate ? d.subjectId : null,
    candidate_name: isCandidate ? d.subjectName : null,
    conflict_type: d.rule,
    field: isCandidate ? d.field : `${d.field} · ${d.subjectName}`,
    source_a: d.sourceA.system,
    source_a_value: d.sourceA.value,
    source_b: d.sourceB.system,
    source_b_value: d.sourceB.value,
    reconciled_value: d.recommended,
    resolution_type: d.resolution === "Auto-resolvable" ? "deterministic_override" : "human_review",
    owner: d.owner,
    status: history.status,
    detected_at: history.detected_at,
    resolved_at: history.resolved_at,
    reason: d.basis,
  };
}

/** Summary over the conflicts detected in the latest run (closed history excluded). */
export function summarize(results: ReconciliationResult[]): ReconciliationSummary {
  const count = (s: ResultStatus) => results.filter((r) => r.status === s).length;
  const tally = <K extends string>(key: (r: ReconciliationResult) => K) =>
    results.reduce<Record<string, number>>((acc, r) => {
      acc[key(r)] = (acc[key(r)] ?? 0) + 1;
      return acc;
    }, {});
  return {
    total_conflicts: results.length,
    auto_resolved: count("auto_resolved"),
    needs_review: count("needs_review"),
    resolved: count("resolved"),
    ignored: count("ignored"),
    conflicts_by_type: tally((r) => r.conflict_type),
    conflicts_by_owner: tally((r) => r.owner),
  };
}
