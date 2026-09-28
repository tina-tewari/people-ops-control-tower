// Row-level rules for the headcount plan and recruiting pipeline. Legacy rows
// carry a one-time Inferred req_id; every candidate added after the backfill
// must be entered against a req_id (req_mapping=Confirmed) with the mandatory
// fields below filled.

export interface FieldRule {
  column: string;
  rule: string;
}

/** Mandatory on every headcount line (one line = one requisition). */
export const REQUIRED_HEADCOUNT_FIELDS: FieldRule[] = [
  { column: "req_id", rule: "Unique. Issued when the headcount is approved." },
  { column: "department", rule: "Owning department." },
  { column: "level", rule: "L1–L5." },
  { column: "approved_headcount", rule: "Number of approved seats." },
  { column: "filled_seats", rule: "Seats already filled." },
  { column: "open_seats", rule: "Seats still open." },
  { column: "target_start_date", rule: "YYYY-MM-DD." },
  { column: "annual_budget_usd", rule: "Approved budget for the line." },
  { column: "priority", rule: "High / Medium / Low." },
];

/** Mandatory on every candidate added to the recruiting pipeline after the backfill. */
export const REQUIRED_CANDIDATE_FIELDS: FieldRule[] = [
  { column: "candidate_id", rule: "Unique." },
  { column: "candidate_name", rule: "Full name." },
  { column: "req_id", rule: "An existing req_id from the headcount plan." },
  { column: "req_mapping", rule: "Confirmed." },
  { column: "role", rule: "Job title being hired." },
  { column: "department", rule: "Must equal the requisition's department." },
  { column: "level", rule: "Must equal the requisition's level." },
  { column: "hiring_manager", rule: "Accountable owner for interview stages." },
  { column: "source", rule: "Referral, LinkedIn, Agency, …" },
  { column: "applied_date", rule: "YYYY-MM-DD." },
  { column: "current_stage", rule: "Current pipeline stage." },
  { column: "disposition", rule: "Active / Hired / Rejected / Withdrew." },
  { column: "rejection_reason", rule: "Only when disposition is Rejected." },
];

/** Date of the one-time backfill. Inferred / Unmatched rows are only valid for candidates who applied before it. */
export const REQ_BACKFILL_DATE = "2026-09-28";

const DISPOSITIONS = ["Active", "Hired", "Rejected", "Withdrew"];
const PRIORITIES = ["High", "Medium", "Low"];
const CONFIDENCES = ["High", "Medium", "Low"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationIssue {
  file: "headcount_plan.csv" | "recruiting_pipeline.csv";
  row: string;
  column: string;
  message: string;
}

type Row = Record<string, string>;

export function validateRequisitionData(headcount: Row[], pipeline: Row[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const reqs = new Map<string, Row>();

  headcount.forEach((h, i) => {
    const row = h.req_id || `line ${i + 2}`;
    const add = (column: string, message: string) => issues.push({ file: "headcount_plan.csv", row, column, message });
    for (const { column } of REQUIRED_HEADCOUNT_FIELDS) if (!h[column]) add(column, "required");
    if (h.req_id && reqs.has(h.req_id)) add("req_id", "duplicate req_id");
    if (h.target_start_date && !DATE.test(h.target_start_date)) add("target_start_date", "expected YYYY-MM-DD");
    if (h.priority && !PRIORITIES.includes(h.priority)) add("priority", `expected ${PRIORITIES.join(" / ")}`);
    if (h.req_id) reqs.set(h.req_id, h);
  });

  const seen = new Set<string>();
  pipeline.forEach((p, i) => {
    const row = p.candidate_id || `line ${i + 2}`;
    const add = (column: string, message: string) => issues.push({ file: "recruiting_pipeline.csv", row, column, message });
    if (p.candidate_id && seen.has(p.candidate_id)) add("candidate_id", "duplicate candidate_id");
    seen.add(p.candidate_id);
    const req = p.req_id ? reqs.get(p.req_id) : undefined;
    if (p.req_id && !req) add("req_id", `unknown req_id ${p.req_id}`);

    switch (p.req_mapping) {
      case "Confirmed":
        for (const { column } of REQUIRED_CANDIDATE_FIELDS) {
          if (column !== "rejection_reason" && !p[column]) add(column, "required");
        }
        if (p.disposition === "Rejected" && !p.rejection_reason) add("rejection_reason", "required when disposition is Rejected");
        if (p.disposition && !DISPOSITIONS.includes(p.disposition)) add("disposition", `expected ${DISPOSITIONS.join(" / ")}`);
        if (p.applied_date && !DATE.test(p.applied_date)) add("applied_date", "expected YYYY-MM-DD");
        if (req && p.department !== req.department) add("department", `req ${p.req_id} is ${req.department}`);
        if (req && p.level !== req.level) add("level", `req ${p.req_id} is ${req.level}`);
        break;
      case "Inferred":
      case "Unmatched":
        if (!p.applied_date || p.applied_date >= REQ_BACKFILL_DATE) {
          add("req_mapping", `${p.req_mapping} is reserved for the ${REQ_BACKFILL_DATE} backfill; new candidates must be Confirmed against a req_id`);
        }
        if (p.req_mapping === "Inferred" && !p.req_id) add("req_id", "Inferred mapping without a req_id");
        if (p.req_mapping === "Inferred" && !CONFIDENCES.includes(p.req_confidence)) add("req_confidence", `expected ${CONFIDENCES.join(" / ")}`);
        if (p.req_mapping === "Unmatched" && p.req_id) add("req_id", "Unmatched rows have no req_id");
        break;
      default:
        add("req_mapping", p.req_mapping ? `unknown value ${p.req_mapping}` : "required: add the candidate against a req_id with req_mapping=Confirmed");
    }
  });
  return issues;
}
