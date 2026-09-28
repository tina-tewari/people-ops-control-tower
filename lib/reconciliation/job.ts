// The recurring reconciliation job. Pure merge of (detected conflicts, prior
// state) → next state; running twice on the same data yields the same state.

import type { Dataset } from "@/lib/types";
import { ROUTING, ownerRoleFor } from "@/config/routing";
import { getDataset } from "@/lib/data/load";
import { reconcile, type Discrepancy } from "./discrepancies";
import {
  fingerprint,
  initialStatus,
  summarize,
  toResult,
  type ReconciliationResult,
  type ReconciliationSummary,
  type ResultStatus,
} from "./results";
import { HUMAN_STATUSES, loadState, saveState, type ReconciliationState } from "./store";

export interface HiringManagerApproval {
  hiring_manager: string;
  items: {
    id: string;
    candidate_id: string | null;
    candidate_name: string | null;
    conflict_type: ReconciliationResult["conflict_type"];
    ask: string;
    since: string;
  }[];
}

export interface ReconciliationRun {
  ran_at: string;
  dataset: Dataset["meta"];
  schedule: typeof ROUTING.schedule;
  summary: ReconciliationSummary;
  /** Conflicts detected in this run. */
  results: ReconciliationResult[];
  /** Previously detected conflicts that no longer appear in the sources. */
  closed: ReconciliationResult[];
  hiring_manager_approvals: HiringManagerApproval[];
}

export function mergeState(
  discrepancies: Discrepancy[],
  prior: ReconciliationState,
  now: string,
): ReconciliationState {
  const next: ReconciliationState = { version: 1, last_run_at: now, results: {} };
  const seen = new Set<string>();

  for (const d of discrepancies) {
    seen.add(d.id);
    const fp = fingerprint(d);
    const old = prior.results[d.id];
    const unchanged = old?.fingerprint === fp;
    const decided = unchanged && old.decided_by && HUMAN_STATUSES.has(old.result.status) ? old : null;
    const status: ResultStatus = decided ? decided.result.status : initialStatus(d);
    const detected_at = unchanged && old.result.status !== "resolved" ? old.result.detected_at : now;
    const resolved_at = decided
      ? decided.result.resolved_at
      : status === "auto_resolved"
        ? detected_at
        : null;
    next.results[d.id] = {
      result: toResult(d, { status, detected_at, resolved_at }),
      fingerprint: fp,
      last_seen_at: now,
      ...(decided ? { decided_by: decided.decided_by } : {}),
    };
  }

  for (const [id, old] of Object.entries(prior.results)) {
    if (seen.has(id)) continue;
    const open = old.result.status === "needs_review";
    next.results[id] = open
      ? {
          ...old,
          result: {
            ...old.result,
            status: "resolved",
            resolved_at: now,
            reason: `${old.result.reason} Closed: no longer detected in source data.`,
          },
        }
      : old;
  }
  return next;
}

export function hiringManagerApprovals(results: ReconciliationResult[]): HiringManagerApproval[] {
  const byHm = new Map<string, HiringManagerApproval["items"]>();
  for (const r of results) {
    if (r.status !== "needs_review" || ownerRoleFor(r.conflict_type) !== "Hiring manager") continue;
    const items = byHm.get(r.owner) ?? [];
    items.push({
      id: r.id,
      candidate_id: r.candidate_id,
      candidate_name: r.candidate_name,
      conflict_type: r.conflict_type,
      ask: `${r.source_a_value}. ${r.reason}`,
      since: r.detected_at,
    });
    byHm.set(r.owner, items);
  }
  return [...byHm.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hiring_manager, items]) => ({
      hiring_manager,
      items: items.sort((a, b) => (a.candidate_name ?? "").localeCompare(b.candidate_name ?? "")),
    }));
}

function buildRun(state: ReconciliationState, dataset: Dataset, now: string): ReconciliationRun {
  const all = Object.values(state.results);
  const results = all.filter((s) => s.last_seen_at === state.last_run_at).map((s) => s.result);
  const closed = all.filter((s) => s.last_seen_at !== state.last_run_at).map((s) => s.result);
  const byId = (a: ReconciliationResult, b: ReconciliationResult) => a.id.localeCompare(b.id);
  results.sort(byId);
  closed.sort(byId);
  return {
    ran_at: now,
    dataset: dataset.meta,
    schedule: ROUTING.schedule,
    summary: summarize(results),
    results,
    closed,
    hiring_manager_approvals: hiringManagerApprovals(results),
  };
}

/**
 * Detect → merge with prior state → optionally persist. With `persist: false`
 * this is a read-only preview (what the dashboard and GET endpoints use).
 */
export function runReconciliation(
  opts: { persist?: boolean; now?: Date; dataset?: Dataset; statePath?: string } = {},
): ReconciliationRun {
  const now = (opts.now ?? new Date()).toISOString();
  const dataset = opts.dataset ?? getDataset();
  const { discrepancies } = reconcile(dataset);
  const prior = loadState(opts.statePath);
  const next = mergeState(discrepancies, prior, now);
  if (opts.persist) saveState(next, opts.statePath);
  return buildRun(next, dataset, now);
}

export class ResultNotFoundError extends Error {}

/** Human status change (resolve / ignore / reopen) from the dashboard or API. */
export function setResultStatus(
  id: string,
  status: ResultStatus,
  opts: { by?: string; now?: Date; statePath?: string } = {},
): ReconciliationResult {
  const state = loadState(opts.statePath);
  const stored = state.results[id];
  if (!stored) throw new ResultNotFoundError(id);
  const now = (opts.now ?? new Date()).toISOString();
  const human = HUMAN_STATUSES.has(status);
  stored.result = { ...stored.result, status, resolved_at: human ? now : null };
  if (human) stored.decided_by = opts.by ?? "api";
  else delete stored.decided_by;
  saveState(state, opts.statePath);
  return stored.result;
}
