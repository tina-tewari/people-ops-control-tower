import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseCsv } from "@/lib/parsers/csv";
import { addCandidateModal, nextCandidateId, openRequisitions, prepareCandidate, type ViewState } from "./addCandidate";

const load = (dataset: string, file: string) =>
  parseCsv(readFileSync(path.join(process.cwd(), "data", dataset, file), "utf8"));

const headcount = load("real", "headcount_plan.csv");
const pipeline = load("real", "recruiting_pipeline.csv");
const req = openRequisitions(headcount)[0];
const today = "2026-10-05";

const submission = (overrides: Record<string, string> = {}): ViewState => {
  const v: Record<string, string> = {
    candidate_name: "Nova Hill",
    req_id: req.req_id,
    role: "Software Engineer",
    hiring_manager: "Jordan Kim",
    source: "Referral",
    applied_date: "2026-10-01",
    current_stage: "Applied",
    disposition: "Active",
    rejection_reason: "",
    ...overrides,
  };
  const selects = new Set(["req_id", "source", "current_stage", "disposition"]);
  return Object.fromEntries(
    Object.entries(v).map(([k, value]) => [
      k,
      {
        [k]:
          k === "applied_date"
            ? { selected_date: value || null }
            : selects.has(k)
              ? { selected_option: value ? { value } : null }
              : { value: value || null },
      },
    ]),
  );
};

test("modal lists only open requisitions and every block has a matching action id", () => {
  const view = addCandidateModal(headcount, { responseUrl: "https://hooks.slack.com/x" }, today);
  const reqBlock = view.blocks.find((b) => "block_id" in b && b.block_id === "req_id") as unknown as {
    element: { options: { value: string }[] };
  };
  const open = headcount.filter((h) => Number(h.open_seats) > 0).map((h) => h.req_id).sort();
  assert.deepEqual(reqBlock.element.options.map((o) => o.value), open);
  for (const b of view.blocks) {
    if ("block_id" in b) assert.equal((b.element as { action_id: string }).action_id, b.block_id);
  }
  assert.ok(view.title.text.length <= 24);
  assert.deepEqual(JSON.parse(view.private_metadata), { responseUrl: "https://hooks.slack.com/x" });
});

test("a complete submission becomes a Confirmed row with the req's department and level", () => {
  const { row, errors } = prepareCandidate(submission(), headcount, pipeline, today);
  assert.deepEqual(errors, {});
  assert.equal(row.candidate_id, "C1312");
  assert.equal(row.req_mapping, "Confirmed");
  assert.equal(row.department, req.department);
  assert.equal(row.level, req.level);
  assert.equal(row.total_days_in_process, "4");
});

test("missing mandatory fields are reported on their modal blocks", () => {
  const { errors } = prepareCandidate(submission({ role: "", hiring_manager: "", req_id: "" }), headcount, pipeline, today);
  assert.equal(errors.role, "required");
  assert.equal(errors.hiring_manager, "required");
  assert.equal(errors.req_id, "required");
});

test("Rejected needs a reason, and a reason needs Rejected", () => {
  assert.match(prepareCandidate(submission({ disposition: "Rejected", current_stage: "Rejected" }), headcount, pipeline, today).errors.rejection_reason ?? "", /required/);
  assert.match(prepareCandidate(submission({ rejection_reason: "No fit" }), headcount, pipeline, today).errors.rejection_reason ?? "", /Only/);
});

test("future applied dates and duplicate candidates on the same req are rejected", () => {
  assert.ok(prepareCandidate(submission({ applied_date: "2026-12-01" }), headcount, pipeline, today).errors.applied_date);
  const existing = pipeline.find((p) => p.req_id === req.req_id)!;
  assert.ok(prepareCandidate(submission({ candidate_name: existing.candidate_name }), headcount, pipeline, today).errors.candidate_name);
});

test("candidate ids follow the dataset's scheme", () => {
  assert.equal(nextCandidateId(load("sample", "recruiting_pipeline.csv")), "S205");
  assert.equal(nextCandidateId([]), "C0001");
});
