// Map raw CSV records (source column names) to typed rows.

import type {
  Disposition,
  HeadcountRow,
  OfferLogRow,
  OfferStatus,
  PeopleEventRow,
  PipelineRow,
  Priority,
} from "@/lib/types";
import { parseCsv } from "./csv";
import { bool, isoDate, num, str } from "./values";

export function parsePipeline(text: string): PipelineRow[] {
  return parseCsv(text).map((r) => ({
    candidateId: r.candidate_id,
    candidateName: r.candidate_name,
    role: r.role,
    department: r.department,
    level: r.level,
    hiringManager: r.hiring_manager,
    source: r.source,
    appliedDate: isoDate(r.applied_date),
    phoneScreenDate: isoDate(r.phone_screen_date),
    assessmentDate: isoDate(r.assessment_date),
    hmInterviewDate: isoDate(r.hm_interview_date),
    finalRoundDate: isoDate(r.final_round_date),
    offerExtendedDate: isoDate(r.offer_extended_date),
    offerCloseDate: isoDate(r.offer_close_date),
    currentStage: r.current_stage,
    daysInCurrentStage: num(r.days_in_current_stage) ?? 0,
    totalDaysInProcess: num(r.total_days_in_process) ?? 0,
    applyToOfferDays: num(r.time_to_offer_days),
    recruitingCycleDays: num(r.time_to_close_days),
    applyToStartDays: num(r.time_to_start_days),
    disposition: r.disposition as Disposition,
    rejectionReason: str(r.rejection_reason),
  }));
}

export function parseHeadcount(text: string): HeadcountRow[] {
  return parseCsv(text).map((r) => ({
    department: r.department,
    level: r.level,
    approvedHeadcount: num(r.approved_headcount) ?? 0,
    filledSeats: num(r.filled_seats) ?? 0,
    openSeats: num(r.open_seats) ?? 0,
    targetStartDate: isoDate(r.target_start_date),
    annualBudgetUsd: num(r.annual_budget_usd) ?? 0,
    priority: r.priority as Priority,
    notes: str(r.notes),
  }));
}

export function parseOfferLog(text: string): OfferLogRow[] {
  return parseCsv(text).map((r) => ({
    offerId: r.offer_id,
    candidateId: r.candidate_id,
    candidateName: r.candidate_name,
    role: r.role,
    department: r.department,
    level: r.level,
    hiringManager: r.hiring_manager,
    location: r.location,
    offerDate: isoDate(r.offer_date),
    startDate: isoDate(r.start_date),
    baseSalaryUsd: num(r.base_salary_usd),
    bonusTargetPct: num(r.bonus_target_pct),
    bonusTargetUsd: num(r.bonus_target_usd),
    commissionPlan: str(r.commission_plan),
    commissionDetail: str(r.commission_detail),
    oteUsd: num(r.ote_usd),
    equityGrantUsd: num(r.equity_grant_usd),
    signingBonusUsd: num(r.signing_bonus_usd),
    offerStatus: r.offer_status as OfferStatus,
    closeDate: isoDate(r.close_date),
    offerDecisionDays: num(r.days_to_close),
    competingOffer: bool(r.competing_offer),
    declineReason: str(r.decline_reason),
  }));
}

export function parsePeopleEvents(text: string): PeopleEventRow[] {
  return parseCsv(text).map((r) => ({
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    eventType: r.event_type,
    eventDate: isoDate(r.event_date),
    department: r.department,
    toDepartment: str(r.to_department),
    role: r.role,
    level: r.level,
    baseSalaryUsd: num(r.base_salary_usd),
    terminationReason: str(r.termination_reason),
    tenureMonths: num(r.tenure_months),
    manager: r.manager,
    location: r.location,
  }));
}
