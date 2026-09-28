// One-time req_id backfill. Adds req_id to every headcount line and
// req_id / req_mapping / req_confidence / req_match_basis to every candidate.
// Rows already marked Confirmed are left untouched; re-running is idempotent.
//
// Usage: DATASET=real npm run backfill:req-ids

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsv, toCsv } from "@/lib/parsers/csv";
import { parseHeadcount, parsePipeline } from "@/lib/parsers/sources";
import { inferCandidateReqs, reqIdFor } from "@/lib/reconciliation/requisitions";

const REQ_COLUMNS = ["req_id", "req_mapping", "req_confidence", "req_match_basis"];

const dir = path.join(process.cwd(), "data", process.env.DATASET ?? "real");
const headcountPath = path.join(dir, "headcount_plan.csv");
const pipelinePath = path.join(dir, "recruiting_pipeline.csv");

const headerOf = (text: string) => text.slice(0, text.search(/\r?\n/)).split(",").map((h) => h.trim());

const headcountText = readFileSync(headcountPath, "utf8");
const pipelineText = readFileSync(pipelinePath, "utf8");
const headcount = parseHeadcount(headcountText);
const pipeline = parsePipeline(pipelineText);

const hcRecords = parseCsv(headcountText).map((r, i) => ({ ...r, req_id: reqIdFor(headcount[i]) }));
const hcHeader = headerOf(headcountText).filter((h) => h !== "req_id");
writeFileSync(headcountPath, toCsv(["req_id", ...hcHeader], hcRecords));

const matches = inferCandidateReqs({ headcount, pipeline });
const counts: Record<string, number> = {};
const plRecords = parseCsv(pipelineText).map((r) => {
  const m = matches.get(r.candidate_id)!;
  const row =
    r.req_mapping === "Confirmed"
      ? r
      : { ...r, req_id: m.reqId ?? "", req_mapping: m.mapping, req_confidence: m.confidence ?? "", req_match_basis: m.basis };
  const key = [row.req_mapping, row.req_confidence].filter(Boolean).join(" ");
  counts[key] = (counts[key] ?? 0) + 1;
  return row;
});
const plHeader = headerOf(pipelineText).filter((h) => !REQ_COLUMNS.includes(h));
writeFileSync(pipelinePath, toCsv([...plHeader, ...REQ_COLUMNS], plRecords));

console.log(`${path.relative(process.cwd(), dir)}: ${hcRecords.length} headcount lines, ${plRecords.length} candidates`);
console.log(counts);
