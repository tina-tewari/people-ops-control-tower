// Recruiting Ops answers to open offer-letter questions (asked in #recruiting-ops).
// A decision applies only while the letter still says exactly what was approved;
// if the letter changes, the question is raised again.

import type { NormalizedOffer } from "@/lib/reconciliation/offers";

interface DecisionBase {
  candidateId: string;
  decision: string;
  decidedBy: string;
  decidedOn: string;
  source: string;
}

export type OfferDecision =
  | (DecisionBase & { kind: "field"; field: keyof NormalizedOffer; letterValue: string | number })
  | (DecisionBase & { kind: "term"; term: string });

const PRIYA_UNCAPPED = {
  candidateId: "C0002",
  decision: "Commission is uncapped; tracked in HubSpot by deals closed by end of quarter.",
  decidedBy: "Recruiting Ops",
  decidedOn: "2026-09-28",
  source: "https://cognition-demo-group.slack.com/archives/C0C51RM5D5X/p1790607965555439",
};

export const OFFER_DECISIONS: OfferDecision[] = [
  {
    ...PRIYA_UNCAPPED,
    kind: "field",
    field: "commissionDetail",
    letterValue: "10% of closed ARR, paid quarterly; uncapped; OTE $142,500",
  },
  { ...PRIYA_UNCAPPED, kind: "term", term: "Commission: uncapped" },
];
