// Who owns what, and how often the reconciliation runs. Edit this file to
// change routing — no logic changes needed.

import type { RuleId } from "@/lib/reconciliation/playbook";

export type OwnerRole = "People Ops" | "Recruiting Ops" | "HRIS" | "Hiring manager";

export const ROUTING = {
  /** Scheduled run (also mirrored in vercel.json). Mondays 13:00 UTC ≈ 8am Central. */
  schedule: { cron: "0 13 * * 1", label: "Weekly on Mondays at 13:00 UTC" },

  /** Where the weekly offer-letter reconciliation asks about anything it cannot resolve. */
  offerReviewChannel: "#recruiting-ops",

  /** Where each owning team receives its queue. */
  channels: {
    "People Ops": "#people-ops-review",
    "Recruiting Ops": "#recruiting-ops",
    HRIS: "#hris-data-quality",
    "Hiring manager": "Direct message",
  } satisfies Record<OwnerRole, string>,

  /** Stalled candidates in these stages are waiting on the hiring manager. */
  hiringManagerStages: ["Hiring Manager Interview", "Final Round"],

  /** Everything else in the active funnel is owned by recruiting. */
  recruiterStages: ["Applied", "Phone Screen", "Technical/Assessment", "Offer Extended"],

  /** Optional per-department recruiting owner; falls back to "Recruiting Ops". */
  recruiterByDepartment: {} as Record<string, string>,

  /**
   * Owning team per reconciliation rule. Rules not listed here route to
   * `fallbackOwner`. "Hiring manager" rules resolve to the candidate's named HM.
   */
  ruleOwners: {
    offerDateCorroborated: "Recruiting Ops",
    offerDateUncorroborated: "Recruiting Ops",
    compMissingInLog: "People Ops",
    termsCorrectedFromLetter: "Recruiting Ops",
    compConflict: "People Ops",
    offerTermsOpen: "Recruiting Ops",
    nonStandardOfferTerm: "Recruiting Ops",
    zeroVariableComp: "People Ops",
    hiredVsDeclined: "People Ops",
    hiredVsNegotiating: "People Ops",
    statusNoDefinitiveSource: "People Ops",
    missingOfferRecord: "Recruiting Ops",
    hireOutsidePipeline: "Recruiting Ops",
    stageDispositionMismatch: "Recruiting Ops",
    filledSeatUntied: "People Ops",
    recruitingWithoutOpenSeat: "People Ops",
    eventIncomplete: "HRIS",
    stalledHiringManagerStage: "Hiring manager",
  } as Partial<Record<RuleId, OwnerRole>>,

  /** Owner for any rule without an entry in `ruleOwners`. */
  fallbackOwner: "People Ops" as OwnerRole,
};

export function channelFor(role: OwnerRole): string {
  return ROUTING.channels[role];
}

export function ownerRoleFor(rule: RuleId): OwnerRole {
  return ROUTING.ruleOwners[rule] ?? ROUTING.fallbackOwner;
}
