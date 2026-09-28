import type { Dataset } from "@/lib/types";
import type { Discrepancy } from "@/lib/reconciliation/discrepancies";
import type { RuleId } from "@/lib/reconciliation/playbook";
import { activeCandidates, isStalled } from "./recruiting";

const STATUS_RULES: RuleId[] = ["hiredVsDeclined", "hiredVsNegotiating", "statusNoDefinitiveSource"];

export interface OverviewKpis {
  approvedHeadcount: number;
  filledHeadcount: number;
  openHeadcount: number;
  activeCandidates: number;
  stalledCandidates: number;
  offersAccepted: number;
  offersDecided: number;
  /** Accepted ÷ (Accepted + Declined), per offer log. Negotiating is excluded. */
  offerAcceptanceRate: number | null;
  offersUnderStatusReview: number;
  unresolvedDiscrepancies: number;
  autoResolvedDiscrepancies: number;
}

export function overviewKpis(ds: Dataset, discrepancies: Discrepancy[]): OverviewKpis {
  const active = activeCandidates(ds.pipeline);
  const accepted = ds.offers.filter((o) => o.offerStatus === "Accepted").length;
  const declined = ds.offers.filter((o) => o.offerStatus === "Declined").length;
  const decided = accepted + declined;
  const sum = (f: (h: Dataset["headcount"][number]) => number) =>
    ds.headcount.reduce((s, h) => s + f(h), 0);

  return {
    approvedHeadcount: sum((h) => h.approvedHeadcount),
    filledHeadcount: sum((h) => h.filledSeats),
    openHeadcount: sum((h) => h.openSeats),
    activeCandidates: active.length,
    stalledCandidates: active.filter(isStalled).length,
    offersAccepted: accepted,
    offersDecided: decided,
    offerAcceptanceRate: decided ? accepted / decided : null,
    offersUnderStatusReview: new Set(
      discrepancies.filter((d) => STATUS_RULES.includes(d.rule)).map((d) => d.subjectId),
    ).size,
    unresolvedDiscrepancies: discrepancies.filter((d) => d.status === "Needs review").length,
    autoResolvedDiscrepancies: discrepancies.filter((d) => d.status === "Auto-resolved").length,
  };
}
