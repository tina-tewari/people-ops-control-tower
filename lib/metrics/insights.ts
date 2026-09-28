// Key findings, written as sentences from live metrics so they stay true when data changes.

import type { ControlTowerCore } from "@/lib/controlTower";
import { formatPct } from "@/lib/format";
import { COVERAGE_AT_RISK, STALLED_DAYS } from "./thresholds";

export type InsightTone = "good" | "warning" | "critical" | "info";

export interface Insight {
  tone: InsightTone;
  headline: string;
  detail: string;
  href: string;
}

export function keyFindings(ct: ControlTowerCore): Insight[] {
  const { kpis, headcountRisk, timing, reqModel } = ct;
  const findings: Insight[] = [];

  const openShare = kpis.approvedHeadcount ? kpis.openHeadcount / kpis.approvedHeadcount : 0;
  const pastDue = headcountRisk.filter((r) => r.flags.includes("Past target start"));
  findings.push({
    tone: openShare >= 0.3 ? "critical" : "warning",
    headline: `${formatPct(openShare)} of approved headcount is still open`,
    detail: `${kpis.openHeadcount} of ${kpis.approvedHeadcount} seats unfilled; ${pastDue.reduce((n, r) => n + r.open, 0)} open seats are past their target start date.`,
    href: "/headcount",
  });

  const thin = headcountRisk.filter(
    (r) => r.priority === "High" && r.open > 0 && (r.coverage ?? 0) < COVERAGE_AT_RISK,
  );
  const worst = thin.toSorted((a, b) => (a.coverage ?? 0) - (b.coverage ?? 0))[0];
  findings.push({
    tone: thin.length ? "critical" : "good",
    headline: `${thin.length} high-priority seat groups have under 1 candidate per open seat`,
    detail: worst
      ? `${thin.reduce((n, r) => n + r.open, 0)} open seats affected. Worst: ${worst.department} ${worst.level}, ${worst.open} open with ${worst.activePipeline} active candidate${worst.activePipeline === 1 ? "" : "s"}.`
      : "Every high-priority opening has at least one active candidate per seat.",
    href: "/headcount?risk=Critical",
  });

  const stalledShare = kpis.activeCandidates ? kpis.stalledCandidates / kpis.activeCandidates : 0;
  findings.push({
    tone: stalledShare > 0.5 ? "critical" : stalledShare > 0.25 ? "warning" : "good",
    headline: `${formatPct(stalledShare)} of active candidates are stalled`,
    detail: `${kpis.stalledCandidates} of ${kpis.activeCandidates} have been in one stage for more than ${STALLED_DAYS} days.`,
    href: "/recruiting?stalled=1",
  });

  const ev = reqModel.evidence;
  const confident = ev.headcountLines - ev.linesWithMultipleRoles;
  findings.push({
    tone: confident / Math.max(1, ev.headcountLines) < 0.5 ? "critical" : "warning",
    headline: `Only ${confident} of ${ev.headcountLines} headcount lines map to a single role`,
    detail: `No requisition ID links a candidate to an approved seat. ${ev.activeOnAmbiguousLines} of ${ev.activeCandidates} active candidates sit on ambiguous lines, and ${ev.activeOnFilledLines} are recruiting against lines with no open seats.`,
    href: "/data-model",
  });

  findings.push({
    tone: "info",
    headline: `Offers close in ${timing.offerDecisionDays ?? "—"} days; the full cycle takes ${timing.recruitingCycleDays ?? "—"} days`,
    detail: "Median offer decision time vs. median recruiting cycle time for hires. The source files call both “close”, so they are now named separately.",
    href: "/data-model#metric-dictionary",
  });

  return findings;
}
