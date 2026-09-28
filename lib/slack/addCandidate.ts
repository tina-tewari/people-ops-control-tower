// /add-candidate: the Slack modal and the mapping from its submission to a
// recruiting_pipeline.csv row. Department and level are taken from the chosen
// requisition, req_mapping is always Confirmed, and the row must pass the same
// rules as `npm run validate:data`.

import { validateRequisitionData } from "@/lib/data/validate";
import { ACTIVE_STAGES } from "@/lib/metrics/thresholds";

type Row = Record<string, string>;

export const ADD_CANDIDATE_CALLBACK = "add_candidate";

export const SOURCES = ["Referral", "LinkedIn", "Agency", "Careers Page", "Job Board", "University"];
export const STAGES = [...ACTIVE_STAGES, "Offer Accepted", "Rejected", "Withdrew"];
export const DISPOSITIONS = ["Active", "Hired", "Rejected", "Withdrew"];

/** Slack caps static_select at 100 options. */
const MAX_OPTIONS = 100;

/** Modal input block ids; each equals the CSV column it fills. */
export const FIELDS = [
  "candidate_name",
  "req_id",
  "role",
  "hiring_manager",
  "source",
  "applied_date",
  "current_stage",
  "disposition",
  "rejection_reason",
] as const;
type Field = (typeof FIELDS)[number];

export interface ModalMetadata {
  responseUrl: string | null;
}

const plain = (text: string) => ({ type: "plain_text" as const, text });
const option = (value: string, label = value) => ({ text: plain(label.slice(0, 75)), value });

function input(field: Field, label: string, element: object, extra: { optional?: boolean; hint?: string } = {}) {
  return {
    type: "input",
    block_id: field,
    label: plain(label),
    element: { ...element, action_id: field },
    optional: extra.optional ?? false,
    ...(extra.hint ? { hint: plain(extra.hint) } : {}),
  };
}

function select(values: string[], initial?: string) {
  return {
    type: "static_select",
    options: values.map((v) => option(v)),
    ...(initial ? { initial_option: option(initial) } : {}),
  };
}

export function openRequisitions(headcount: Row[]): Row[] {
  return headcount
    .filter((h) => h.req_id && Number(h.open_seats) > 0)
    .sort((a, b) => a.req_id.localeCompare(b.req_id))
    .slice(0, MAX_OPTIONS);
}

export function addCandidateModal(headcount: Row[], meta: ModalMetadata, today: string) {
  const reqs = openRequisitions(headcount);
  return {
    type: "modal",
    callback_id: ADD_CANDIDATE_CALLBACK,
    private_metadata: JSON.stringify(meta),
    title: plain("Add candidate"),
    submit: plain("Open PR"),
    close: plain("Cancel"),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Adds the candidate to the recruiting pipeline against a requisition (`req_mapping=Confirmed`) and opens a PR for review. Department and level come from the requisition.",
        },
      },
      input("candidate_name", "Candidate name", { type: "plain_text_input" }),
      input(
        "req_id",
        "Requisition",
        {
          type: "static_select",
          placeholder: plain("Open requisitions"),
          options: reqs.map((h) => option(h.req_id, `${h.req_id} · ${h.department} ${h.level} · ${h.open_seats} open`)),
        },
        { hint: "Only requisitions with open seats are listed." },
      ),
      input("role", "Role (job title)", { type: "plain_text_input" }),
      input("hiring_manager", "Hiring manager", { type: "plain_text_input" }),
      input("source", "Source", select(SOURCES)),
      input("applied_date", "Applied date", { type: "datepicker", initial_date: today }),
      input("current_stage", "Current stage", select(STAGES, "Applied")),
      input("disposition", "Disposition", select(DISPOSITIONS, "Active")),
      input("rejection_reason", "Rejection reason", { type: "plain_text_input" }, {
        optional: true,
        hint: "Required when disposition is Rejected.",
      }),
    ],
  };
}

interface StateValue {
  value?: string | null;
  selected_date?: string | null;
  selected_option?: { value: string } | null;
}
export type ViewState = Record<string, Record<string, StateValue>>;

function valueOf(state: ViewState, field: Field): string {
  const v = state[field]?.[field];
  return (v?.value ?? v?.selected_date ?? v?.selected_option?.value ?? "").trim();
}

/** Next id in the dataset's dominant scheme, e.g. C1311 → C1312, S204 → S205. */
export function nextCandidateId(pipeline: Row[]): string {
  const ids = pipeline
    .map((p) => p.candidate_id.match(/^([A-Z]+)(\d+)$/))
    .filter((m): m is RegExpMatchArray => m !== null);
  const counts = new Map<string, number>();
  for (const m of ids) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  const prefix = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "C";
  const mine = ids.filter((m) => m[1] === prefix).map((m) => m[2]);
  const max = Math.max(0, ...mine.map(Number));
  const width = mine.length ? Math.max(...mine.map((d) => d.length)) : 4;
  return prefix + String(max + 1).padStart(width, "0");
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export interface PreparedCandidate {
  row: Row;
  /** Keyed by modal block id, in the shape Slack's response_action=errors expects. */
  errors: Partial<Record<Field, string>>;
}

export function prepareCandidate(state: ViewState, headcount: Row[], pipeline: Row[], today: string): PreparedCandidate {
  const v = Object.fromEntries(FIELDS.map((f) => [f, valueOf(state, f)])) as Record<Field, string>;
  const req = headcount.find((h) => h.req_id === v.req_id);
  const applied = v.applied_date;
  const row: Row = {
    candidate_id: nextCandidateId(pipeline),
    candidate_name: v.candidate_name,
    role: v.role,
    department: req?.department ?? "",
    level: req?.level ?? "",
    hiring_manager: v.hiring_manager,
    source: v.source,
    applied_date: applied,
    current_stage: v.current_stage,
    days_in_current_stage: "0",
    total_days_in_process: applied ? String(Math.max(0, daysBetween(applied, today))) : "",
    disposition: v.disposition,
    rejection_reason: v.rejection_reason,
    req_id: v.req_id,
    req_mapping: "Confirmed",
  };

  const errors: PreparedCandidate["errors"] = {};
  const blockFor = (column: string): Field =>
    column === "department" || column === "level"
      ? "req_id"
      : ((FIELDS as readonly string[]).includes(column) ? (column as Field) : "candidate_name");
  for (const issue of validateRequisitionData(headcount, [...pipeline, row])) {
    if (issue.file !== "recruiting_pipeline.csv" || issue.row !== row.candidate_id) continue;
    errors[blockFor(issue.column)] ??= issue.message;
  }
  if (applied && applied > today) errors.applied_date ??= "Applied date can't be in the future.";
  if (v.rejection_reason && v.disposition !== "Rejected") {
    errors.rejection_reason ??= "Only fill this in when disposition is Rejected.";
  }
  const name = v.candidate_name.toLowerCase();
  if (name && pipeline.some((p) => p.req_id === v.req_id && p.candidate_name.toLowerCase() === name)) {
    errors.candidate_name ??= `${v.candidate_name} is already in the pipeline for ${v.req_id}.`;
  }
  return { row, errors };
}
