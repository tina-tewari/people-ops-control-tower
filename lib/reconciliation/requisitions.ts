// Conceptual requisition model. The headcount plan and recruiting pipeline share
// no req_id, so this demo infers the link on department + level. Every mapping
// is labeled "Inferred"; production should require req_id upstream.

import type { Dataset, HeadcountRow, PipelineRow, Priority } from "@/lib/types";

/**
 * How much to trust an inferred mapping. High: one role and one hiring manager
 * match the line. Medium: one of the two is unique. Low: neither is.
 */
export type MappingConfidence = "High" | "Medium" | "Low";

export interface Requisition {
  reqId: string;
  department: string;
  role: string;
  level: string;
  hiringManager: string;
  targetStartDate: string | null;
  priority: Priority;
  status: "Open" | "Filled";
  mapping: "Inferred";
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

function mostCommon(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

function toRequisition(h: HeadcountRow, candidates: PipelineRow[]): Requisition {
  const roles = mostCommon(candidates.map((c) => c.role));
  const managers = mostCommon(candidates.map((c) => c.hiringManager));
  return {
    reqId: `REQ-${deptCode(h.department)}-${h.level}`,
    department: h.department,
    role: roles[0] ?? "Unspecified",
    level: h.level,
    hiringManager: managers[0] ?? "Unassigned",
    targetStartDate: h.targetStartDate,
    priority: h.priority,
    status: h.openSeats > 0 ? "Open" : "Filled",
    mapping: "Inferred",
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
}

export interface RequisitionModel {
  requisitions: Requisition[];
  /** Active candidates whose department + level has no headcount line. */
  unmapped: PipelineRow[];
  evidence: MappingEvidence;
}

export function inferRequisitions(ds: Dataset): RequisitionModel {
  const byKey = new Map<string, PipelineRow[]>();
  for (const p of ds.pipeline) {
    const k = inferredKey(p.department, p.level);
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }
  const planned = new Set(ds.headcount.map((h) => inferredKey(h.department, h.level)));
  const requisitions = ds.headcount.map((h) =>
    toRequisition(h, byKey.get(inferredKey(h.department, h.level)) ?? []),
  );
  return {
    requisitions,
    unmapped: ds.pipeline.filter(
      (p) => p.disposition === "Active" && !planned.has(inferredKey(p.department, p.level)),
    ),
    evidence: mappingEvidence(ds, requisitions),
  };
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
  };
}
