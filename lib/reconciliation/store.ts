// File-backed status history so daily runs are idempotent: stable ids,
// first-seen timestamps, and human decisions (resolved / ignored) survive reruns.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ReconciliationResult, ResultStatus } from "./results";

export interface StoredResult {
  result: ReconciliationResult;
  fingerprint: string;
  last_seen_at: string;
  /** Set when a person resolves or ignores the item; that decision sticks until the values change. */
  decided_by?: string;
}

export interface ReconciliationState {
  version: 1;
  last_run_at: string | null;
  results: Record<string, StoredResult>;
}

export const EMPTY_STATE: ReconciliationState = { version: 1, last_run_at: null, results: {} };

export function statePath(): string {
  return (
    process.env.RECONCILIATION_STATE_PATH ??
    path.join(process.cwd(), ".reconciliation", `${process.env.DATASET ?? "real"}.json`)
  );
}

export function loadState(file = statePath()): ReconciliationState {
  if (!existsSync(file)) return structuredClone(EMPTY_STATE);
  return JSON.parse(readFileSync(file, "utf8")) as ReconciliationState;
}

/** Atomic write: a crash mid-run never leaves a half-written state file. */
export function saveState(state: ReconciliationState, file = statePath()): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  renameSync(tmp, file);
}

export const HUMAN_STATUSES: ReadonlySet<ResultStatus> = new Set(["resolved", "ignored"]);
