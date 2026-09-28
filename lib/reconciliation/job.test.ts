import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ownerRoleFor } from "@/config/routing";
import { getDataset } from "@/lib/data/load";
import type { Discrepancy } from "./discrepancies";
import { mergeState, runReconciliation, setResultStatus } from "./job";
import { EMPTY_STATE, loadState } from "./store";

const T1 = "2026-01-01T13:00:00.000Z";
const T2 = "2026-01-02T13:00:00.000Z";
const T3 = "2026-01-03T13:00:00.000Z";

const conflict = (overrides: Partial<Discrepancy> = {}): Discrepancy => ({
  id: "hiredVsDeclined:C1:Offer status",
  rule: "hiredVsDeclined",
  category: "Candidate status",
  action: "Escalate",
  subjectId: "C1",
  subjectName: "Ada",
  field: "Offer status",
  sourceA: { system: "Recruiting pipeline", value: "Hired" },
  sourceB: { system: "Offer log", value: "Declined" },
  recommended: null,
  basis: "Escalate",
  resolution: "Human review",
  ownerRole: "People Ops",
  owner: "People Ops",
  status: "Needs review",
  ...overrides,
});

const tmpState = () => path.join(mkdtempSync(path.join(tmpdir(), "recon-")), "state.json");

test("rerunning on unchanged data is idempotent", () => {
  const s1 = mergeState([conflict()], EMPTY_STATE, T1);
  const s2 = mergeState([conflict()], s1, T2);
  const r = s2.results[conflict().id].result;
  assert.equal(r.status, "needs_review");
  assert.equal(r.detected_at, T1);
  const results = (s: typeof s1) => Object.values(s.results).map((x) => x.result);
  assert.deepEqual(results(s2), results(s1));
});

test("human decisions persist until the conflicting values change", () => {
  const file = tmpState();
  const ds = getDataset();
  const first = runReconciliation({ persist: true, dataset: ds, statePath: file, now: new Date(T1) });
  const target = first.results.find((r) => r.status === "needs_review")!;
  setResultStatus(target.id, "ignored", { by: "tina", statePath: file, now: new Date(T2) });

  const second = runReconciliation({ persist: true, dataset: ds, statePath: file, now: new Date(T3) });
  const after = second.results.find((r) => r.id === target.id)!;
  assert.equal(after.status, "ignored");
  assert.equal(after.resolved_at, T2);
  assert.equal(after.detected_at, T1);
  assert.equal(second.summary.total_conflicts, first.summary.total_conflicts);

  const changed = conflict({ sourceB: { system: "Offer log", value: "Accepted" } });
  const s = mergeState([changed], mergeState([conflict()], EMPTY_STATE, T1), T2);
  assert.equal(s.results[changed.id].result.status, "needs_review");
  assert.equal(s.results[changed.id].result.detected_at, T2);
});

test("a growing stall count does not reopen a handled approval", () => {
  const stall = (days: number) =>
    conflict({
      id: "stalledHiringManagerStage:C2:Days in stage",
      rule: "stalledHiringManagerStage",
      field: "Days in stage",
      sourceA: { system: "Recruiting pipeline", value: `Hiring Manager Interview for ${days} days` },
      sourceB: { system: "Recruiting pipeline", value: "Stall threshold 7 days" },
      ownerRole: "Hiring manager",
      owner: "Grace",
      identity: "Hiring Manager Interview past 7 days",
    });
  const s1 = mergeState([stall(9)], EMPTY_STATE, T1);
  const stored = s1.results[stall(9).id];
  stored.result = { ...stored.result, status: "ignored", resolved_at: T1 };
  stored.decided_by = "grace";
  const r = mergeState([stall(10)], s1, T2).results[stall(10).id].result;
  assert.equal(r.status, "ignored");
  assert.equal(r.detected_at, T1);
  assert.equal(r.source_a_value, "Hiring Manager Interview for 10 days");
});

test("open conflicts that disappear from the sources are closed as resolved", () => {
  const s = mergeState([], mergeState([conflict()], EMPTY_STATE, T1), T2);
  const r = s.results[conflict().id].result;
  assert.equal(r.status, "resolved");
  assert.equal(r.resolved_at, T2);
});

test("dry runs never write state", () => {
  const file = tmpState();
  runReconciliation({ statePath: file });
  assert.deepEqual(loadState(file), EMPTY_STATE);
});

test("rules classify and route as configured", () => {
  const run = runReconciliation({ statePath: tmpState(), now: new Date(T1) });
  const byType = (t: string) => run.results.filter((r) => r.conflict_type === t);

  for (const r of byType("offerDateCorroborated")) {
    assert.equal(r.resolution_type, "deterministic_override");
    assert.equal(r.status, "auto_resolved");
    assert.equal(r.reconciled_value, r.source_b_value);
  }
  for (const r of byType("compConflict")) {
    assert.equal(r.resolution_type, "human_review");
    assert.equal(r.reconciled_value, null);
  }
  for (const t of ["hiredVsDeclined", "hiredVsNegotiating"]) {
    assert.ok(byType(t).length > 0);
    for (const r of byType(t)) {
      assert.equal(r.owner, "People Ops");
      assert.equal(r.status, "needs_review");
    }
  }
  for (const r of byType("filledSeatUntied")) assert.equal(r.candidate_id, null);

  const pipeline = new Map(getDataset().pipeline.map((p) => [p.candidateId, p]));
  const stalled = byType("stalledHiringManagerStage");
  assert.ok(stalled.length > 0);
  for (const r of stalled) {
    const p = pipeline.get(r.candidate_id!)!;
    assert.equal(r.owner, p.hiringManager);
    assert.ok(p.daysInCurrentStage > 7);
  }
  assert.equal(
    run.hiring_manager_approvals.reduce((n, h) => n + h.items.length, 0),
    stalled.filter((r) => r.status === "needs_review").length,
  );

  assert.equal(ownerRoleFor("stageDateMismatch"), "People Ops");
  assert.equal(run.summary.total_conflicts, run.summary.auto_resolved + run.summary.needs_review);
});
