// The reconciliation playbook: every conflict type maps to exactly one system action.
// Auto actions fix the reconciled record; everything else is routed to an owner.

import { ownerRoleFor, type OwnerRole } from "@/config/routing";

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
  | "eventIncomplete"
  | "stageDateMismatch"
  | "stalledHiringManagerStage";

/** What a conflict is about; decides whether it carries a candidate_id. */
export type Subject = "candidate" | "employee" | "headcount_line";

export interface Rule {
  id: RuleId;
  conflict: string;
  action: SystemAction;
  category: Category;
  /** Resolved from config/routing.ts; never hardcoded here. */
  ownerRole: OwnerRole;
  subject: Subject;
}

const rule = (id: RuleId, conflict: string, action: SystemAction, category: Category, subject: Subject = "candidate"): Rule =>
  ({ id, conflict, action, category, ownerRole: ownerRoleFor(id), subject });

export const RULES: Record<RuleId, Rule> = {
  offerDateCorroborated: rule("offerDateCorroborated", "Pipeline offer date ≠ offer log, and offer log = offer letter", "Auto-correct", "Offer dates"),
  compMissingInLog: rule("compMissingInLog", "Offer log missing a comp term that the offer letter contains", "Populate reconciled value", "Structured-data gap"),
  termsCorrectedFromLetter: rule("termsCorrectedFromLetter", "Accepted offer: log role/level/location/start date differs from signed letter", "Auto-correct", "Offer terms"),
  hiredVsDeclined: rule("hiredVsDeclined", "Pipeline says Hired, offer log says Declined", "Escalate", "Candidate status"),
  hiredVsNegotiating: rule("hiredVsNegotiating", "Pipeline says Hired, offer log says Negotiating", "Escalate", "Candidate status"),
  compConflict: rule("compConflict", "Offer log and offer letter both state a comp term, with different values", "Escalate", "Compensation"),
  zeroVariableComp: rule("zeroVariableComp", "Variable plan on file but OTE equals base", "Escalate", "Compensation"),
  filledSeatUntied: rule("filledSeatUntied", "Headcount says seat filled but no candidate can be tied to it", "Flag for Ops review", "Headcount", "headcount_line"),
  recruitingWithoutOpenSeat: rule("recruitingWithoutOpenSeat", "Active candidates on a headcount line with no open seats", "Flag for Ops review", "Headcount", "headcount_line"),
  offerDateUncorroborated: rule("offerDateUncorroborated", "Offer date differs and no second source corroborates either value", "Ping owner", "Offer dates"),
  offerTermsOpen: rule("offerTermsOpen", "Offer terms differ while the offer is still open", "Ping owner", "Offer terms"),
  statusNoDefinitiveSource: rule("statusNoDefinitiveSource", "Offer log says Accepted but pipeline does not say Hired", "Ping owner", "Candidate status"),
  missingOfferRecord: rule("missingOfferRecord", "Pipeline shows an extended offer with no offer-log record", "Ping owner", "Candidate status"),
  hireOutsidePipeline: rule("hireOutsidePipeline", "HRIS shows a Hire but the pipeline record is still open or closed out", "Ping owner", "Candidate status"),
  stageDispositionMismatch: rule("stageDispositionMismatch", "Pipeline stage and disposition contradict each other", "Ping owner", "Pipeline hygiene"),
  eventIncomplete: rule("eventIncomplete", "Employee event missing or contradicting required attributes", "Ping owner", "Employee events", "employee"),
  stageDateMismatch: rule("stageDateMismatch", "Pipeline stage and interview dates disagree, with no authoritative source", "Ping owner", "Pipeline hygiene"),
  stalledHiringManagerStage: rule("stalledHiringManagerStage", "Candidate stalled in a hiring-manager stage beyond the threshold", "Ping hiring manager", "Pipeline hygiene"),
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
  "stageDateMismatch",
  "stalledHiringManagerStage",
  "eventIncomplete",
];
