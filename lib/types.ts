// Typed shapes for each source system. Column names mirror the source CSVs;
// fields are camelCased and empty cells become null.

export type ISODate = string; // YYYY-MM-DD

export type Disposition = "Active" | "Hired" | "Rejected" | "Withdrew";

/**
 * How a candidate is tied to a requisition. Confirmed: entered by a recruiter
 * against an open req_id (required for every new candidate). Inferred: one-time
 * backfill, matched on department + level and scored on role, hiring manager and
 * target start date. Unmatched: backfill found no headcount line.
 */
export type ReqMapping = "Confirmed" | "Inferred" | "Unmatched";

/**
 * How much to trust an inferred mapping. High: role, hiring manager and timing
 * all agree with the requisition. Medium: two of the three. Low: one or none.
 */
export type MappingConfidence = "High" | "Medium" | "Low";

export interface PipelineRow {
  candidateId: string;
  candidateName: string;
  reqId: string | null;
  reqMapping: ReqMapping | null;
  /** Set on Inferred mappings only. */
  reqConfidence: MappingConfidence | null;
  /** Fields that agreed with the requisition, e.g. "department+level+role". */
  reqMatchBasis: string | null;
  role: string;
  department: string;
  level: string;
  hiringManager: string;
  source: string;
  appliedDate: ISODate | null;
  phoneScreenDate: ISODate | null;
  assessmentDate: ISODate | null;
  hmInterviewDate: ISODate | null;
  finalRoundDate: ISODate | null;
  offerExtendedDate: ISODate | null;
  offerCloseDate: ISODate | null;
  currentStage: string;
  daysInCurrentStage: number;
  totalDaysInProcess: number;
  /** Source: time_to_offer_days. Applied → offer extended. */
  applyToOfferDays: number | null;
  /** Source: time_to_close_days. Applied → offer closed: the whole recruiting cycle. */
  recruitingCycleDays: number | null;
  /** Source: time_to_start_days. Applied → start date. */
  applyToStartDays: number | null;
  disposition: Disposition;
  rejectionReason: string | null;
}

export type Priority = "High" | "Medium" | "Low";

export interface HeadcountRow {
  reqId: string | null;
  department: string;
  level: string;
  approvedHeadcount: number;
  filledSeats: number;
  openSeats: number;
  targetStartDate: ISODate | null;
  annualBudgetUsd: number;
  priority: Priority;
  notes: string | null;
}

export type OfferStatus = "Accepted" | "Declined" | "Negotiating";

export interface OfferLogRow {
  offerId: string;
  candidateId: string;
  candidateName: string;
  role: string;
  department: string;
  level: string;
  hiringManager: string;
  location: string;
  offerDate: ISODate | null;
  startDate: ISODate | null;
  baseSalaryUsd: number | null;
  bonusTargetPct: number | null;
  bonusTargetUsd: number | null;
  commissionPlan: string | null;
  commissionDetail: string | null;
  oteUsd: number | null;
  equityGrantUsd: number | null;
  signingBonusUsd: number | null;
  offerStatus: OfferStatus;
  closeDate: ISODate | null;
  /** Source: days_to_close. Offer extended → candidate decision (offer stage only). */
  offerDecisionDays: number | null;
  competingOffer: boolean;
  declineReason: string | null;
}

export interface PeopleEventRow {
  employeeId: string;
  employeeName: string;
  eventType: string;
  eventDate: ISODate | null;
  department: string;
  toDepartment: string | null;
  role: string;
  level: string;
  baseSalaryUsd: number | null;
  terminationReason: string | null;
  tenureMonths: number | null;
  manager: string;
  location: string;
}

/** Fields extracted from an unstructured offer letter. */
export interface OfferLetter {
  fileName: string;
  candidateId: string | null;
  candidateName: string | null;
  letterDate: ISODate | null;
  hiringManager: string | null;
  role: string | null;
  department: string | null;
  level: string | null;
  location: string | null;
  startDate: ISODate | null;
  baseSalaryUsd: number | null;
  basePayFrequency: string | null;
  bonusTargetPct: number | null;
  bonusTargetUsd: number | null;
  commissionPlan: string | null;
  commissionDetail: string | null;
  oteUsd: number | null;
  equityGrantUsd: number | null;
  vestingSchedule: string | null;
  signingBonusUsd: number | null;
  signingBonusRepaymentMonths: number | null;
  benefits: string[];
  employmentTerms: string[];
  acceptanceWindowBusinessDays: number | null;
  /** Terms that deviate from the standard template (see config/offerStandards.ts). */
  specialTerms: string[];
}

export interface DatasetMeta {
  label: string;
  isSample: boolean;
  /** Latest date observed across sources; "today" for time-relative checks. */
  asOf: ISODate;
}

export interface Dataset {
  meta: DatasetMeta;
  pipeline: PipelineRow[];
  headcount: HeadcountRow[];
  offers: OfferLogRow[];
  events: PeopleEventRow[];
  letters: OfferLetter[];
}
