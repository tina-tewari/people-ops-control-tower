// Requisition model. Each headcount line carries a req_id and each candidate
// points at one. Legacy candidates were linked by a one-time backfill
// (inferCandidateReqs) and stay labeled "Inferred"; new candidates must be
// entered against a req_id ("Confirmed"; see lib/data/validate.ts).

import type {
  Dataset,
  HeadcountRow,
  MappingConfidence,
  PipelineRow,
  Priority,
  ReqMapping,
} from "@/lib/types";
import { daysBetween } from "@/lib/parsers/values";

export type { MappingConfidence };

export interface Requisition {
  reqId: string;
  department: string;
  role: string;
  level: string;
  hiringManager: string;
  targetStartDate: string | null;
  priority: Priority;
  status: "Open" | "Filled";
  /** Confirmed only when every candidate on the req was entered against it. */
  mapping: "Confirmed" | "Inferred";
  /** Line-level: how many roles and hiring managers share this req. */
  confidence: MappingConfidence;
  approvedSeats: number;
  filledSeats: number;
  openSeats: number;
  /** Distinct pipeline roles and HMs matched on department + level. */
  matchedRoles: string[];
  matchedManagers: string[];
  activeCandidates: PipelineRow[];
}

const deptCode = (dept: string) => {
  const words = dept.split(/\s+/);
  return (words.length > 1 ? words.map((w) => w[0]).join("") : dept.slice(0, 3)).toUpperCase();
};

export const inferredKey = (department: string, level: string) => `${department}|${level}`;

/** req_id issued for a headcount line; the backfill used this format. */
export const reqIdFor = (h: Pick<HeadcountRow, "reqId" | "department" | "level">) =>
  h.reqId ?? `REQ-${deptCode(h.department)}-${h.level}`;

/** Distinct hires per department + level: Hired pipeline candidates plus HRIS Hire events. */
export function tracedHiresByLine(ds: Dataset): Map<string, number> {
  const names = new Map<string, Set<string>>();
  const add = (key: string, name: string) => names.set(key, (names.get(key) ?? new Set()).add(name));
  for (const p of ds.pipeline) if (p.disposition === "Hired") add(inferredKey(p.department, p.level), p.candidateName);
  for (const e of ds.events) if (e.eventType === "Hire") add(inferredKey(e.department, e.level), e.employeeName);
  return new Map([...names].map(([k, v]) => [k, v.size]));
}

/** Filled seats per line that no hire can be traced to. */
export function untracedFilledSeats(ds: Dataset): { line: HeadcountRow; traced: number; untraced: number }[] {
  const traced = tracedHiresByLine(ds);
  return ds.headcount.map((h) => {
    const t = traced.get(inferredKey(h.department, h.level)) ?? 0;
    return { line: h, traced: t, untraced: Math.max(0, h.filledSeats - t) };
  });
}

export function mostCommon(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

function toRequisition(h: HeadcountRow, candidates: PipelineRow[]): Requisition {
  const roles = mostCommon(candidates.map((c) => c.role));
  const managers = mostCommon(candidates.map((c) => c.hiringManager));
  return {
    reqId: reqIdFor(h),
    department: h.department,
    role: roles[0] ?? "Unspecified",
    level: h.level,
    hiringManager: managers[0] ?? "Unassigned",
    targetStartDate: h.targetStartDate,
    priority: h.priority,
    status: h.openSeats > 0 ? "Open" : "Filled",
    mapping: candidates.length > 0 && candidates.every((c) => c.reqMapping === "Confirmed") ? "Confirmed" : "Inferred",
    confidence:
      roles.length <= 1 && managers.length <= 1 ? "High"
      : roles.length <= 1 || managers.length <= 1 ? "Medium"
      : "Low",
    approvedSeats: h.approvedHeadcount,
    filledSeats: h.filledSeats,
    openSeats: h.openSeats,
    matchedRoles: roles,
    matchedManagers: managers,
    activeCandidates: candidates.filter((c) => c.disposition === "Active"),
  };
}

export interface RoleLevelSpread {
  role: string;
  /** Candidate count per level, e.g. { L1: 2, L3: 5 }. */
  byLevel: Record<string, number>;
  levels: number;
}

/** Evidence that department + level cannot identify a seat. */
export interface MappingEvidence {
  headcountLines: number;
  linesWithMultipleRoles: number;
  linesWithMultipleManagers: number;
  maxRolesOnOneLine: { count: number; reqId: string; roles: string[] };
  rolesSeen: number;
  rolesAtMultipleLevels: number;
  roleSpread: RoleLevelSpread[];
  activeCandidates: number;
  activeOnAmbiguousLines: number;
  activeOnFilledLines: number;
  untracedFilledSeats: number;
  /** Candidates per req_mapping (and per confidence for Inferred). */
  candidateMappings: Record<ReqMapping | `Inferred ${MappingConfidence}` | "Missing", number>;
}

export interface RequisitionModel {
  requisitions: Requisition[];
  /** Active candidates whose department + level has no headcount line. */
  unmapped: PipelineRow[];
  evidence: MappingEvidence;
}

/**
 * The req_id a candidate belongs to: the one on the row, else the headcount line
 * for its department + level (datasets that predate the backfill).
 */
export function candidateReqIds(ds: Pick<Dataset, "headcount" | "pipeline">): Map<string, string | null> {
  const byLine = new Map(ds.headcount.map((h) => [inferredKey(h.department, h.level), reqIdFor(h)]));
  return new Map(
    ds.pipeline.map((p) => [p.candidateId, p.reqId ?? byLine.get(inferredKey(p.department, p.level)) ?? null]),
  );
}

export function inferRequisitions(ds: Dataset): RequisitionModel {
  const reqOf = candidateReqIds(ds);
  const byReq = new Map<string, PipelineRow[]>();
  for (const p of ds.pipeline) {
    const id = reqOf.get(p.candidateId);
    if (id) byReq.set(id, [...(byReq.get(id) ?? []), p]);
  }
  const issued = new Set(ds.headcount.map(reqIdFor));
  const requisitions = ds.headcount.map((h) => toRequisition(h, byReq.get(reqIdFor(h)) ?? []));
  return {
    requisitions,
    unmapped: ds.pipeline.filter((p) => {
      const id = reqOf.get(p.candidateId);
      return p.disposition === "Active" && !(id && issued.has(id));
    }),
    evidence: mappingEvidence(ds, requisitions),
  };
}

/** A start this far from the req's target start date still counts as on time. */
export const TIMING_WINDOW_DAYS = 90;

export interface CandidateReqMatch {
  reqId: string | null;
  mapping: Exclude<ReqMapping, "Confirmed">;
  confidence: MappingConfidence | null;
  basis: string;
}

/**
 * Timing agrees when the candidate applied on or before the req's target start
 * and, if a start date is known (applied + time_to_start_days), started within
 * TIMING_WINDOW_DAYS of it.
 */
function timingFits(p: PipelineRow, targetStart: string | null): boolean {
  if (!targetStart || !p.appliedDate || p.appliedDate > targetStart) return false;
  if (p.applyToStartDays === null) return true;
  const start = new Date(Date.parse(p.appliedDate) + p.applyToStartDays * 86_400_000).toISOString().slice(0, 10);
  return Math.abs(daysBetween(targetStart, start)) <= TIMING_WINDOW_DAYS;
}

/**
 * One-time req_id backfill for candidates entered before req_id existed. The
 * headcount plan is only keyed by department + level, so that pair picks the
 * req; role, hiring manager and target start date then score how well the
 * candidate fits it. Every result is Inferred (or Unmatched), never Confirmed.
 */
export function inferCandidateReqs(ds: Pick<Dataset, "headcount" | "pipeline">): Map<string, CandidateReqMatch> {
  const lines = new Map(ds.headcount.map((h) => [inferredKey(h.department, h.level), h]));
  const onLine = new Map<string, PipelineRow[]>();
  for (const p of ds.pipeline) {
    const k = inferredKey(p.department, p.level);
    onLine.set(k, [...(onLine.get(k) ?? []), p]);
  }
  const profile = new Map(
    [...onLine].map(([k, ps]) => [k, {
      role: mostCommon(ps.map((p) => p.role))[0],
      manager: mostCommon(ps.map((p) => p.hiringManager))[0],
    }]),
  );

  return new Map(ds.pipeline.map((p): [string, CandidateReqMatch] => {
    const k = inferredKey(p.department, p.level);
    const line = lines.get(k);
    if (!line) {
      return [p.candidateId, { reqId: null, mapping: "Unmatched", confidence: null, basis: "no headcount line for department+level" }];
    }
    const { role, manager } = profile.get(k)!;
    const signals: [string, boolean][] = [
      ["role", p.role === role],
      ["hiring_manager", p.hiringManager === manager],
      ["target_start_date", timingFits(p, line.targetStartDate)],
    ];
    const agreed = signals.filter(([, ok]) => ok).map(([f]) => f);
    return [p.candidateId, {
      reqId: reqIdFor(line),
      mapping: "Inferred",
      confidence: agreed.length === 3 ? "High" : agreed.length === 2 ? "Medium" : "Low",
      basis: ["department", "level", ...agreed].join("+"),
    }];
  }));
}

function mappingEvidence(ds: Dataset, reqs: Requisition[]): MappingEvidence {
  const spread = new Map<string, Record<string, number>>();
  for (const p of ds.pipeline) {
    const levels = spread.get(p.role) ?? {};
    levels[p.level] = (levels[p.level] ?? 0) + 1;
    spread.set(p.role, levels);
  }
  const roleSpread = [...spread.entries()]
    .map(([role, byLevel]) => ({ role, byLevel, levels: Object.keys(byLevel).length }))
    .sort((a, b) => b.levels - a.levels || a.role.localeCompare(b.role));

  const widest = reqs.toSorted((a, b) => b.matchedRoles.length - a.matchedRoles.length)[0];
  const active = ds.pipeline.filter((p) => p.disposition === "Active").length;
  const sumActive = (rs: Requisition[]) => rs.reduce((n, r) => n + r.activeCandidates.length, 0);

  return {
    headcountLines: reqs.length,
    linesWithMultipleRoles: reqs.filter((r) => r.matchedRoles.length > 1).length,
    linesWithMultipleManagers: reqs.filter((r) => r.matchedManagers.length > 1).length,
    maxRolesOnOneLine: {
      count: widest?.matchedRoles.length ?? 0,
      reqId: widest?.reqId ?? "—",
      roles: widest?.matchedRoles ?? [],
    },
    rolesSeen: roleSpread.length,
    rolesAtMultipleLevels: roleSpread.filter((r) => r.levels > 1).length,
    roleSpread,
    activeCandidates: active,
    activeOnAmbiguousLines: sumActive(reqs.filter((r) => r.confidence !== "High")),
    activeOnFilledLines: sumActive(reqs.filter((r) => r.openSeats === 0)),
    untracedFilledSeats: untracedFilledSeats(ds).reduce((n, l) => n + l.untraced, 0),
    candidateMappings: candidateMappingCounts(ds.pipeline),
  };
}

function candidateMappingCounts(pipeline: PipelineRow[]): MappingEvidence["candidateMappings"] {
  const counts: MappingEvidence["candidateMappings"] = {
    Confirmed: 0, Inferred: 0, "Inferred High": 0, "Inferred Medium": 0, "Inferred Low": 0, Unmatched: 0, Missing: 0,
  };
  for (const p of pipeline) {
    counts[p.reqMapping ?? "Missing"]++;
    if (p.reqMapping === "Inferred" && p.reqConfidence) counts[`Inferred ${p.reqConfidence}`]++;
  }
  return counts;
}
