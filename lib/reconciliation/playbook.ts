// The reconciliation playbook: every conflict type maps to exactly one system action.
// Auto actions fix the reconciled record; everything else is routed to an owner.

import type { OwnerRole } from "@/config/routing";

export type SystemAction =
  | "Auto-correct"
  | "Populate reconciled value"
  | "Escalate"
  | "Flag for Ops review"
  | "Ping hiring manager"
  | "Ping owner";

export type ResolutionType = "Auto-resolvable" | "Human review";

export type Category =
  | "Candidate status"
  | "Offer dates"
  | "Offer terms"
  | "Compensation"
  | "Structured-data gap"
  | "Headcount"
  | "Pipeline hygiene"
  | "Employee events";

export type RuleId =
  | "offerDateCorroborated"
  | "offerDateUncorroborated"
  | "compMissingInLog"
  | "termsCorrectedFromLetter"
  | "compConflict"
  | "offerTermsOpen"
  | "zeroVariableComp"
  | "hiredVsDeclined"
  | "hiredVsNegotiating"
  | "statusNoDefinitiveSource"
  | "missingOfferRecord"
  | "hireOutsidePipeline"
  | "stageDispositionMismatch"
  | "filledSeatUntied"
  | "recruitingWithoutOpenSeat"
  | "eventIncomplete";

export interface Rule {
  id: RuleId;
  conflict: string;
  action: SystemAction;
  category: Category;
  ownerRole: OwnerRole;
}

const rule = (id: RuleId, conflict: string, action: SystemAction, category: Category, ownerRole: OwnerRole): Rule =>
  ({ id, conflict, action, category, ownerRole });

export const RULES: Record<RuleId, Rule> = {
  offerDateCorroborated: rule("offerDateCorroborated", "Pipeline offer date ≠ offer log, and offer log = offer letter", "Auto-correct", "Offer dates", "Recruiting Ops"),
  compMissingInLog: rule("compMissingInLog", "Offer log missing a comp term that the offer letter contains", "Populate reconciled value", "Structured-data gap", "People Ops"),
  termsCorrectedFromLetter: rule("termsCorrectedFromLetter", "Accepted offer: log role/level/location/start date differs from signed letter", "Auto-correct", "Offer terms", "Recruiting Ops"),
  hiredVsDeclined: rule("hiredVsDeclined", "Pipeline says Hired, offer log says Declined", "Escalate", "Candidate status", "People Ops"),
  hiredVsNegotiating: rule("hiredVsNegotiating", "Pipeline says Hired, offer log says Negotiating", "Escalate", "Candidate status", "People Ops"),
  compConflict: rule("compConflict", "Offer log and offer letter both state a comp term, with different values", "Escalate", "Compensation", "People Ops"),
  zeroVariableComp: rule("zeroVariableComp", "Variable plan on file but OTE equals base", "Escalate", "Compensation", "People Ops"),
  filledSeatUntied: rule("filledSeatUntied", "Headcount says seat filled but no candidate can be tied to it", "Flag for Ops review", "Headcount", "People Ops"),
  recruitingWithoutOpenSeat: rule("recruitingWithoutOpenSeat", "Active candidates on a headcount line with no open seats", "Flag for Ops review", "Headcount", "People Ops"),
  offerDateUncorroborated: rule("offerDateUncorroborated", "Offer date differs and no second source corroborates either value", "Ping owner", "Offer dates", "Recruiting Ops"),
  offerTermsOpen: rule("offerTermsOpen", "Offer terms differ while the offer is still open", "Ping owner", "Offer terms", "Recruiting Ops"),
  statusNoDefinitiveSource: rule("statusNoDefinitiveSource", "Offer log says Accepted but pipeline does not say Hired", "Ping owner", "Candidate status", "People Ops"),
  missingOfferRecord: rule("missingOfferRecord", "Pipeline shows an extended offer with no offer-log record", "Ping owner", "Candidate status", "Recruiting Ops"),
  hireOutsidePipeline: rule("hireOutsidePipeline", "HRIS shows a Hire but the pipeline record is still open or closed out", "Ping owner", "Candidate status", "Recruiting Ops"),
  stageDispositionMismatch: rule("stageDispositionMismatch", "Pipeline stage and disposition contradict each other", "Ping owner", "Pipeline hygiene", "Recruiting Ops"),
  eventIncomplete: rule("eventIncomplete", "Employee event missing or contradicting required attributes", "Ping owner", "Employee events", "HRIS"),
};

export const AUTO_ACTIONS: SystemAction[] = ["Auto-correct", "Populate reconciled value"];

export const resolutionFor = (action: SystemAction): ResolutionType =>
  AUTO_ACTIONS.includes(action) ? "Auto-resolvable" : "Human review";

/** Rows shown in the playbook table, in the order leadership reads them. */
export const PLAYBOOK_ORDER: RuleId[] = [
  "offerDateCorroborated",
  "compMissingInLog",
  "termsCorrectedFromLetter",
  "hiredVsDeclined",
  "hiredVsNegotiating",
  "compConflict",
  "zeroVariableComp",
  "filledSeatUntied",
  "recruitingWithoutOpenSeat",
  "offerDateUncorroborated",
  "offerTermsOpen",
  "statusNoDefinitiveSource",
  "missingOfferRecord",
  "hireOutsidePipeline",
  "stageDispositionMismatch",
  "eventIncomplete",
];
