import type { PipelineRow } from "@/lib/types";
import { ACTIVE_STAGES, STALLED_DAYS } from "./thresholds";

export const isStalled = (p: PipelineRow) => p.daysInCurrentStage > STALLED_DAYS;

export function activeCandidates(pipeline: PipelineRow[]): PipelineRow[] {
  return pipeline
    .filter((p) => p.disposition === "Active")
    .sort((a, b) => b.daysInCurrentStage - a.daysInCurrentStage);
}

export interface StageSummary {
  stage: string;
  count: number;
  stalled: number;
  avgDays: number | null;
}

export function stageSummary(active: PipelineRow[]): StageSummary[] {
  const known = new Set<string>(ACTIVE_STAGES);
  const extra = [...new Set(active.map((p) => p.currentStage))].filter((s) => !known.has(s));
  return [...ACTIVE_STAGES, ...extra].map((stage) => {
    const rows = active.filter((p) => p.currentStage === stage);
    return {
      stage,
      count: rows.length,
      stalled: rows.filter(isStalled).length,
      avgDays: rows.length
        ? rows.reduce((s, p) => s + p.daysInCurrentStage, 0) / rows.length
        : null,
    };
  });
}

export interface ManagerSummary {
  hiringManager: string;
  active: number;
  stalled: number;
  oldestDays: number;
  stalledShare: number;
}

export function managerSummary(active: PipelineRow[]): ManagerSummary[] {
  const byHm = new Map<string, PipelineRow[]>();
  for (const p of active) byHm.set(p.hiringManager, [...(byHm.get(p.hiringManager) ?? []), p]);
  return [...byHm.entries()]
    .map(([hiringManager, rows]) => {
      const stalled = rows.filter(isStalled).length;
      return {
        hiringManager,
        active: rows.length,
        stalled,
        oldestDays: Math.max(...rows.map((r) => r.daysInCurrentStage)),
        stalledShare: stalled / rows.length,
      };
    })
    .sort((a, b) => b.stalled - a.stalled || b.oldestDays - a.oldestDays);
}
