// Cross-system discrepancy detection. Each detector emits records tagged with a
// playbook rule; the rule decides the system action, resolution type and owner.

import type { Dataset, OfferLogRow, PipelineRow } from "@/lib/types";
import type { OwnerRole } from "@/config/routing";
import { formatValue } from "@/lib/format";
import { ACTIVE_STAGES } from "@/lib/metrics/thresholds";
import { compareOffers, type OfferComparison } from "./offers";
import {
  RULES,
  resolutionFor,
  type Category,
  type ResolutionType,
  type RuleId,
  type SystemAction,
} from "./playbook";
import { resolveByHierarchy, type SourceSystem } from "./sourceOfTruth";
import { inferredKey, untracedFilledSeats } from "./requisitions";

export type DiscrepancyStatus = "Auto-resolved" | "Needs review";

export interface SourceValue {
  system: SourceSystem;
  value: string;
}

export interface Discrepancy {
  id: string;
  rule: RuleId;
  category: Category;
  action: SystemAction;
  subjectId: string;
  subjectName: string;
  field: string;
  sourceA: SourceValue;
  sourceB: SourceValue;
  recommended: string | null;
  basis: string;
  resolution: ResolutionType;
  ownerRole: OwnerRole;
  /** A named person when routing resolves to one (e.g. the hiring manager). */
  owner: string;
  status: DiscrepancyStatus;
}

interface Draft {
  rule: RuleId;
  subjectId: string;
  subjectName: string;
  field: string;
  sourceA: SourceValue;
  sourceB: SourceValue;
  recommended?: string | null;
  basis: string;
}

function finalize(d: Draft): Discrepancy {
  const r = RULES[d.rule];
  const resolution = resolutionFor(r.action);
  return {
    ...d,
    id: `${d.rule}:${d.subjectId}:${d.field}`,
    category: r.category,
    action: r.action,
    recommended: d.recommended ?? null,
    resolution,
    ownerRole: r.ownerRole,
    owner: r.ownerRole,
    status: resolution === "Auto-resolvable" ? "Auto-resolved" : "Needs review",
  };
}

/** Pipeline disposition and offer-log status must describe the same outcome. */
function statusConflicts(ds: Dataset, p: PipelineRow, o: OfferLogRow): Draft[] {
  const pipelineHired = p.disposition === "Hired";
  if (pipelineHired === (o.offerStatus === "Accepted")) return [];

  const hire = ds.events.find((e) => e.eventType === "Hire" && e.employeeName === p.candidateName);
  const evidence = hire
    ? `People events show a Hire on ${hire.eventDate}.`
    : "No matching Hire event in people events.";
  const rule: RuleId = !pipelineHired
    ? "statusNoDefinitiveSource"
    : o.offerStatus === "Declined"
      ? "hiredVsDeclined"
      : "hiredVsNegotiating";

  return [{
    rule,
    subjectId: p.candidateId,
    subjectName: p.candidateName,
    field: "Offer status",
    sourceA: { system: "Recruiting pipeline", value: `${p.disposition} (${p.currentStage})` },
    sourceB: {
      system: "Offer log",
      value: o.declineReason ? `${o.offerStatus} — ${o.declineReason}` : o.offerStatus,
    },
    basis: `Changes headcount and payroll; never auto-resolved. ${evidence}`,
  }];
}

/** Offer date: auto-correct only when a second source corroborates the top-ranked one. */
function offerDateConflict(p: PipelineRow, o: OfferLogRow, letterDate: string | null): Draft[] {
  const values = {
    "Offer letter": letterDate,
    "Offer log": o.offerDate,
    "Recruiting pipeline": p.offerExtendedDate,
  };
  const r = resolveByHierarchy(["Offer letter", "Offer log", "Recruiting pipeline"], values);
  if (!r || r.dissenting.length === 0) return [];

  const corroborated = r.corroboratedBy.length > 0;
  const [dissentSystem, dissentValue] = r.dissenting.at(-1)!;
  return [{
    rule: corroborated ? "offerDateCorroborated" : "offerDateUncorroborated",
    subjectId: p.candidateId,
    subjectName: p.candidateName,
    field: "Offer date",
    sourceA: { system: dissentSystem, value: dissentValue },
    sourceB: { system: r.source, value: r.value },
    recommended: corroborated ? r.value : null,
    basis: corroborated
      ? `${r.basis}; ${dissentSystem.toLowerCase()} is corrected.`
      : `${r.basis}. No definitive source; confirm the date.`,
  }];
}

/** Every extended offer must exist in the offer log. */
function missingOfferRecords(ds: Dataset, offerIds: Set<string>): Draft[] {
  return ds.pipeline
    .filter((p) => p.offerExtendedDate && !offerIds.has(p.candidateId))
    .map((p) => ({
      rule: "missingOfferRecord" as const,
      subjectId: p.candidateId,
      subjectName: p.candidateName,
      field: "Offer record",
      sourceA: { system: "Recruiting pipeline" as const, value: `Offer extended ${p.offerExtendedDate}` },
      sourceB: { system: "Offer log" as const, value: "No record" },
      basis: "Create the offer-log entry so comp terms can be reconciled.",
    }));
}

/** A Hire in people events must match a Hired pipeline record. */
function hiresOutsidePipeline(ds: Dataset): Draft[] {
  const byName = new Map(ds.pipeline.map((p) => [p.candidateName, p]));
  return ds.events
    .filter((e) => e.eventType === "Hire")
    .flatMap((e) => {
      const p = byName.get(e.employeeName);
      if (!p || p.disposition === "Hired") return [];
      return [{
        rule: "hireOutsidePipeline" as const,
        subjectId: p.candidateId,
        subjectName: p.candidateName,
        field: "Hire status",
        sourceA: { system: "Recruiting pipeline" as const, value: `${p.disposition} (${p.currentStage})` },
        sourceB: { system: "People events" as const, value: `Hire on ${e.eventDate} (${e.employeeId})` },
        basis: "Hired in HRIS without an accepted offer on file. Verify the offer and close out the pipeline record.",
      }];
    });
}

/** An active funnel stage cannot carry a closed disposition, and vice versa. */
function stageDispositionMismatches(ds: Dataset): Draft[] {
  const activeStages = new Set<string>(ACTIVE_STAGES);
  return ds.pipeline
    .filter((p) => activeStages.has(p.currentStage) !== (p.disposition === "Active"))
    .map((p) => ({
      rule: "stageDispositionMismatch" as const,
      subjectId: p.candidateId,
      subjectName: p.candidateName,
      field: "Stage vs. disposition",
      sourceA: { system: "Recruiting pipeline" as const, value: `Stage: ${p.currentStage}` },
      sourceB: { system: "Recruiting pipeline" as const, value: `Disposition: ${p.disposition}` },
      basis: "The candidate cannot be in an active stage and closed at the same time.",
    }));
}

/** Offer-log fields vs. fields extracted from the offer letter. */
function offerLetterConflicts(comparisons: OfferComparison[]): Draft[] {
  return comparisons.flatMap((c) =>
    c.fields
      .filter((f) => f.rule !== null)
      .map((f) => {
        const stateLabel =
          f.state === "missing_in_log" ? "Missing in offer log"
          : f.state === "missing_in_letter" ? "Not in offer letter"
          : "Values conflict";
        const basis: Record<string, string> = {
          termsCorrectedFromLetter: `${stateLabel}. Signed letter outranks the offer log for an accepted offer.`,
          compMissingInLog: `${stateLabel}. Extracted from the letter; the offer log needs this field captured.`,
          compConflict: `${stateLabel}. Compensation is never overwritten automatically.`,
          offerTermsOpen: `${stateLabel}. Offer is ${c.offerStatus.toLowerCase()}, so terms are not final.`,
        };
        return {
          rule: f.rule!,
          subjectId: c.candidateId,
          subjectName: c.candidateName,
          field: f.label,
          sourceA: { system: "Offer log" as const, value: formatValue(f.log, f.format) },
          sourceB: { system: "Offer letter" as const, value: formatValue(f.letter, f.format) },
          recommended: f.reconciled != null ? formatValue(f.reconciled, f.format) : null,
          basis: basis[f.rule!],
        };
      }),
  );
}

/** A variable-comp plan with OTE equal to base implies $0 variable pay. */
function zeroVariableComp(offers: OfferLogRow[]): Draft[] {
  return offers
    .filter((o) => o.commissionPlan && o.oteUsd != null && o.oteUsd === o.baseSalaryUsd)
    .map((o) => ({
      rule: "zeroVariableComp" as const,
      subjectId: o.candidateId,
      subjectName: o.candidateName,
      field: "OTE",
      sourceA: { system: "Offer log" as const, value: `${o.commissionPlan}: OTE ${formatValue(o.oteUsd, "usd")}` },
      sourceB: { system: "Offer log" as const, value: `Base ${formatValue(o.baseSalaryUsd, "usd")}` },
      basis: "Variable plan on file but OTE equals base, so the variable amount is $0 or was never recorded.",
    }));
}

/**
 * Each filled seat should trace to a hire: a Hired pipeline candidate or an HRIS
 * Hire event for the same department + level (inferred link, no req_id).
 */
function untiedFilledSeats(ds: Dataset): Draft[] {
  return untracedFilledSeats(ds)
    .filter((l) => l.untraced > 0)
    .map(({ line: h, traced, untraced }) => ({
      rule: "filledSeatUntied" as const,
      subjectId: `${h.department} ${h.level}`,
      subjectName: `${h.department} · ${h.level}`,
      field: "Filled seats",
      sourceA: { system: "Headcount plan" as const, value: `${h.filledSeats} filled` },
      sourceB: { system: "People events" as const, value: `${traced} traceable hire${traced === 1 ? "" : "s"}` },
      basis: `${untraced} filled seat${untraced === 1 ? "" : "s"} cannot be tied to a candidate or hire (matched on department + level; inferred).`,
    }));
}

/** Candidates are being recruited against a line whose seats are all filled. */
function recruitingWithoutOpenSeat(ds: Dataset): Draft[] {
  const active = new Map<string, number>();
  for (const p of ds.pipeline) {
    if (p.disposition !== "Active") continue;
    const k = inferredKey(p.department, p.level);
    active.set(k, (active.get(k) ?? 0) + 1);
  }
  return ds.headcount.flatMap((h) => {
    const n = active.get(inferredKey(h.department, h.level)) ?? 0;
    if (h.openSeats > 0 || n === 0) return [];
    return [{
      rule: "recruitingWithoutOpenSeat" as const,
      subjectId: `${h.department} ${h.level}`,
      subjectName: `${h.department} · ${h.level}`,
      field: "Open seats",
      sourceA: { system: "Headcount plan" as const, value: `0 open (${h.filledSeats}/${h.approvedHeadcount} filled)` },
      sourceB: { system: "Recruiting pipeline" as const, value: `${n} active candidate${n === 1 ? "" : "s"}` },
      basis: "Recruiting for a line with no approved opening. Either the plan is stale or these candidates belong to another seat (no req_id to tell).",
    }];
  });
}

/** Employee events must carry the attributes reporting depends on. */
function incompleteEvents(ds: Dataset): Draft[] {
  return ds.events.flatMap((e): Draft[] => {
    const base = { rule: "eventIncomplete" as const, subjectId: e.employeeId, subjectName: e.employeeName };
    if (e.eventType === "Termination" && !e.terminationReason) {
      return [{
        ...base,
        field: "Termination reason",
        sourceA: { system: "People events", value: `Termination on ${e.eventDate}` },
        sourceB: { system: "People events", value: "Reason blank" },
        basis: "Attrition cannot be split into voluntary vs. involuntary without a reason.",
      }];
    }
    if (e.eventType === "Transfer" && e.toDepartment === e.department) {
      return [{
        ...base,
        field: "Transfer destination",
        sourceA: { system: "People events", value: `From ${e.department}` },
        sourceB: { system: "People events", value: `To ${e.toDepartment}` },
        basis: "Transfer within the same department, probably a mislabeled promotion or role change.",
      }];
    }
    return [];
  });
}

export interface ReconciliationResult {
  discrepancies: Discrepancy[];
  offerComparisons: OfferComparison[];
}

export function reconcile(ds: Dataset): ReconciliationResult {
  const offerByCandidate = new Map(ds.offers.map((o) => [o.candidateId, o]));
  const letterByCandidate = new Map(ds.letters.map((l) => [l.candidateId, l]));
  const offerComparisons = compareOffers(ds.offers, ds.letters);

  const drafts: Draft[] = [
    ...ds.pipeline.flatMap((p) => {
      const o = offerByCandidate.get(p.candidateId);
      if (!o) return [];
      return [
        ...statusConflicts(ds, p, o),
        ...offerDateConflict(p, o, letterByCandidate.get(p.candidateId)?.letterDate ?? null),
      ];
    }),
    ...missingOfferRecords(ds, new Set(offerByCandidate.keys())),
    ...hiresOutsidePipeline(ds),
    ...stageDispositionMismatches(ds),
    ...offerLetterConflicts(offerComparisons),
    ...zeroVariableComp(ds.offers),
    ...untiedFilledSeats(ds),
    ...recruitingWithoutOpenSeat(ds),
    ...incompleteEvents(ds),
  ];

  const discrepancies = drafts.map(finalize);
  discrepancies.sort(
    (a, b) =>
      Number(a.resolution === "Auto-resolvable") - Number(b.resolution === "Auto-resolvable") ||
      a.category.localeCompare(b.category) ||
      a.subjectId.localeCompare(b.subjectId),
  );
  return { discrepancies, offerComparisons };
}
