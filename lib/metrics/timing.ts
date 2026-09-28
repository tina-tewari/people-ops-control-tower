import type { Dataset } from "@/lib/types";
import { median } from "./stats";

export interface TimingSummary {
  /** Offer log: offer extended → decision. */
  offerDecisionDays: number | null;
  /** Pipeline, hired candidates: applied → offer closed. */
  recruitingCycleDays: number | null;
  applyToOfferDays: number | null;
  applyToStartDays: number | null;
  hiredCount: number;
}

export function timingSummary(ds: Dataset): TimingSummary {
  const hired = ds.pipeline.filter((p) => p.disposition === "Hired");
  return {
    offerDecisionDays: median(ds.offers.map((o) => o.offerDecisionDays)),
    recruitingCycleDays: median(hired.map((p) => p.recruitingCycleDays)),
    applyToOfferDays: median(hired.map((p) => p.applyToOfferDays)),
    applyToStartDays: median(hired.map((p) => p.applyToStartDays)),
    hiredCount: hired.length,
  };
}

export interface ManagerTiming {
  hiringManager: string;
  hires: number;
  applyToOfferDays: number;
}

/** Median time to offer per hiring manager, slowest first. */
export function timeToOfferByManager(ds: Dataset): ManagerTiming[] {
  const byHm = new Map<string, number[]>();
  for (const p of ds.pipeline) {
    if (p.applyToOfferDays == null) continue;
    byHm.set(p.hiringManager, [...(byHm.get(p.hiringManager) ?? []), p.applyToOfferDays]);
  }
  return [...byHm.entries()]
    .map(([hiringManager, days]) => ({ hiringManager, hires: days.length, applyToOfferDays: median(days)! }))
    .sort((a, b) => b.applyToOfferDays - a.applyToOfferDays);
}
