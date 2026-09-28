import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseCsv } from "@/lib/parsers/csv";
import { validateRequisitionData } from "./validate";

const load = (dataset: string, file: string) =>
  parseCsv(readFileSync(path.join(process.cwd(), "data", dataset, file), "utf8"));

const headcount = load("sample", "headcount_plan.csv");
const legacy = load("sample", "recruiting_pipeline.csv");
const reqId = headcount[0].req_id;

const newCandidate = (overrides: Record<string, string> = {}) => ({
  candidate_id: "N001",
  candidate_name: "Nova Hill",
  req_id: reqId,
  req_mapping: "Confirmed",
  req_confidence: "",
  req_match_basis: "",
  role: "Software Engineer",
  department: headcount[0].department,
  level: headcount[0].level,
  hiring_manager: "Taylor Reed",
  source: "Referral",
  applied_date: "2026-10-01",
  current_stage: "Applied",
  disposition: "Active",
  rejection_reason: "",
  ...overrides,
});

const issuesFor = (row: Record<string, string>) =>
  validateRequisitionData(headcount, [...legacy, row]).map((i) => `${i.row} ${i.column}`);

test("committed datasets pass after the backfill", () => {
  for (const ds of ["real", "sample"]) {
    assert.deepEqual(validateRequisitionData(load(ds, "headcount_plan.csv"), load(ds, "recruiting_pipeline.csv")), []);
  }
});

test("a complete new candidate against an existing req passes", () => {
  assert.deepEqual(issuesFor(newCandidate()), []);
});

test("a new candidate without a req_id is rejected", () => {
  assert.deepEqual(issuesFor(newCandidate({ req_id: "", req_mapping: "" })), ["N001 req_mapping"]);
  assert.deepEqual(issuesFor(newCandidate({ req_id: "" })), ["N001 req_id"]);
});

test("new candidates cannot use the backfill's Inferred label", () => {
  assert.deepEqual(issuesFor(newCandidate({ req_mapping: "Inferred", req_confidence: "High" })), ["N001 req_mapping"]);
});

test("a confirmed candidate must match the req and fill every mandatory field", () => {
  assert.deepEqual(issuesFor(newCandidate({ req_id: "REQ-NOPE-L9" })), ["N001 req_id"]);
  assert.deepEqual(issuesFor(newCandidate({ level: "L5" })), ["N001 level"]);
  assert.deepEqual(issuesFor(newCandidate({ hiring_manager: "", source: "" })), ["N001 hiring_manager", "N001 source"]);
  assert.deepEqual(issuesFor(newCandidate({ disposition: "Rejected" })), ["N001 rejection_reason"]);
});

test("headcount lines need a unique req_id", () => {
  const dup = [...headcount, { ...headcount[1], req_id: reqId }];
  assert.deepEqual(validateRequisitionData(dup, []).map((i) => i.message), ["duplicate req_id"]);
});
