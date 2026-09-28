import type { Priority } from "@/lib/types";
import type { Requisition } from "@/lib/reconciliation/requisitions";
import { COVERAGE_AT_RISK, COVERAGE_HEALTHY } from "./thresholds";

export type RiskStatus = "Healthy" | "At Risk" | "Critical";

export interface HeadcountRiskRow {
  reqId: string;
  department: string;
  level: string;
  approved: number;
  filled: number;
  open: number;
  priority: Priority;
  targetStartDate: string | null;
  activePipeline: number;
  /** Active candidates per open seat; null when there are no open seats. */
  coverage: number | null;
  risk: RiskStatus;
  flags: string[];
}

export function classifyCoverage(open: number, coverage: number | null): RiskStatus {
  if (open === 0 || coverage == null) return "Healthy";
  if (coverage >= COVERAGE_HEALTHY) return "Healthy";
  if (coverage >= COVERAGE_AT_RISK) return "At Risk";
  return "Critical";
}

export function headcountRisk(
  requisitions: Requisition[],
  asOf: string,
): HeadcountRiskRow[] {
  const rank: Record<RiskStatus, number> = { Critical: 0, "At Risk": 1, Healthy: 2 };
  const prio: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

  return requisitions
    .map((r) => {
      const active = r.activeCandidates.length;
      const coverage = r.openSeats > 0 ? active / r.openSeats : null;
      const risk = classifyCoverage(r.openSeats, coverage);

      const flags: string[] = [];
      if (r.priority === "High" && r.openSeats > 0 && (coverage ?? 0) < COVERAGE_AT_RISK) {
        flags.push(active === 0 ? "High priority · no pipeline" : "High priority · thin pipeline");
      }
      if (r.openSeats > 0 && r.targetStartDate && r.targetStartDate < asOf) {
        flags.push("Past target start");
      }
      if (r.openSeats === 0 && active > 0) flags.push("Pipeline with no open seat");

      return {
        reqId: r.reqId,
        department: r.department,
        level: r.level,
        approved: r.approvedSeats,
        filled: r.filledSeats,
        open: r.openSeats,
        priority: r.priority,
        targetStartDate: r.targetStartDate,
        activePipeline: active,
        coverage,
        risk,
        flags,
      };
    })
    .sort(
      (a, b) =>
        rank[a.risk] - rank[b.risk] ||
        prio[a.priority] - prio[b.priority] ||
        (a.coverage ?? Infinity) - (b.coverage ?? Infinity),
    );
}
