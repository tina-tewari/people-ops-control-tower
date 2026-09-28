// Normalized offer schema + structured (offer log) vs. extracted (offer letter) comparison.

import { OFFER_DECISIONS, type OfferDecision } from "@/config/offerDecisions";
import type { OfferLetter, OfferLogRow, OfferStatus } from "@/lib/types";
import type { RuleId } from "./playbook";

export interface NormalizedOffer {
  candidateId: string;
  candidateName: string;
  role: string | null;
  department: string | null;
  level: string | null;
  hiringManager: string | null;
  location: string | null;
  startDate: string | null;
  baseSalaryUsd: number | null;
  bonusTargetPct: number | null;
  bonusTargetUsd: number | null;
  commissionPlan: string | null;
  commissionDetail: string | null;
  oteUsd: number | null;
  equityGrantUsd: number | null;
  signingBonusUsd: number | null;
  /** Letter-only terms: the offer log has no columns for these. */
  vestingSchedule: string | null;
  signingBonusRepaymentMonths: number | null;
  specialTerms: string[];
}

type ComparableField = Exclude<
  keyof NormalizedOffer,
  "candidateId" | "candidateName" | "specialTerms" | "vestingSchedule" | "signingBonusRepaymentMonths"
>;

export const OFFER_FIELDS: {
  key: ComparableField;
  label: string;
  kind: "terms" | "compensation";
  format: "text" | "usd" | "pct" | "date";
}[] = [
  { key: "role", label: "Role", kind: "terms", format: "text" },
  { key: "department", label: "Department", kind: "terms", format: "text" },
  { key: "level", label: "Level", kind: "terms", format: "text" },
  { key: "hiringManager", label: "Hiring manager", kind: "terms", format: "text" },
  { key: "location", label: "Location", kind: "terms", format: "text" },
  { key: "startDate", label: "Start date", kind: "terms", format: "date" },
  { key: "baseSalaryUsd", label: "Base salary", kind: "compensation", format: "usd" },
  { key: "bonusTargetPct", label: "Bonus target %", kind: "compensation", format: "pct" },
  { key: "bonusTargetUsd", label: "Bonus target $", kind: "compensation", format: "usd" },
  { key: "commissionPlan", label: "Variable plan", kind: "compensation", format: "text" },
  { key: "commissionDetail", label: "Variable plan detail", kind: "compensation", format: "text" },
  { key: "oteUsd", label: "OTE", kind: "compensation", format: "usd" },
  { key: "equityGrantUsd", label: "Equity", kind: "compensation", format: "usd" },
  { key: "signingBonusUsd", label: "Signing bonus", kind: "compensation", format: "usd" },
];

export type FieldState = "match" | "missing_in_log" | "missing_in_letter" | "conflict";

export type FieldResolution =
  | "Confirmed"
  | "Auto-corrected"
  | "Populated from letter"
  | "Confirmed by Ops"
  | "Needs review";

export interface FieldComparison {
  key: ComparableField;
  label: string;
  kind: "terms" | "compensation";
  format: (typeof OFFER_FIELDS)[number]["format"];
  log: string | number | null;
  letter: string | number | null;
  state: FieldState;
  resolution: FieldResolution;
  /** Playbook rule that fired, or null when sources agree. */
  rule: RuleId | null;
  /** Trusted value for the normalized offer; null while under review. */
  reconciled: string | number | null;
  /** Recruiting Ops decision that settled a field that would otherwise need review. */
  decision?: OfferDecision;
}

/**
 * Per-offer outcome of letter vs. log reconciliation:
 * - Verified: every field matches and the letter has no non-standard terms.
 * - Resolved: differences were auto-corrected / populated from the signed letter.
 * - Flagged: something needs a human (comp conflict, open offer, non-standard term).
 * - No letter: nothing to reconcile against.
 */
export type OfferVerification = "Verified" | "Resolved" | "Flagged" | "No letter";

export interface OfferComparison {
  offerId: string;
  candidateId: string;
  candidateName: string;
  offerStatus: OfferStatus;
  letterFile: string | null;
  fields: FieldComparison[];
  /** Special terms in the letter that the structured log does not capture. */
  letterOnlyTerms: string[];
  /** Non-standard letter terms Recruiting Ops has approved. */
  approvedTerms: { term: string; decision: OfferDecision }[];
  verification: OfferVerification;
  normalized: NormalizedOffer;
}

export function verificationOf(fields: FieldComparison[], letterOnlyTerms: string[]): OfferVerification {
  if (fields.some((f) => f.resolution === "Needs review") || letterOnlyTerms.length) return "Flagged";
  if (fields.some((f) => f.resolution !== "Confirmed")) return "Resolved";
  return "Verified";
}

export function fromOfferLog(o: OfferLogRow): NormalizedOffer {
  return {
    candidateId: o.candidateId,
    candidateName: o.candidateName,
    role: o.role,
    department: o.department,
    level: o.level,
    hiringManager: o.hiringManager,
    location: o.location,
    startDate: o.startDate,
    baseSalaryUsd: o.baseSalaryUsd,
    bonusTargetPct: o.bonusTargetPct,
    bonusTargetUsd: o.bonusTargetUsd,
    commissionPlan: o.commissionPlan,
    commissionDetail: o.commissionDetail,
    oteUsd: o.oteUsd,
    equityGrantUsd: o.equityGrantUsd,
    signingBonusUsd: o.signingBonusUsd,
    vestingSchedule: null,
    signingBonusRepaymentMonths: null,
    specialTerms: [],
  };
}

export function fromOfferLetter(l: OfferLetter): NormalizedOffer {
  return {
    candidateId: l.candidateId ?? "",
    candidateName: l.candidateName ?? "",
    role: l.role,
    department: l.department,
    level: l.level,
    hiringManager: l.hiringManager,
    location: l.location,
    startDate: l.startDate,
    baseSalaryUsd: l.baseSalaryUsd,
    bonusTargetPct: l.bonusTargetPct,
    bonusTargetUsd: l.bonusTargetUsd,
    commissionPlan: l.commissionPlan,
    commissionDetail: l.commissionDetail,
    oteUsd: l.oteUsd,
    equityGrantUsd: l.equityGrantUsd,
    signingBonusUsd: l.signingBonusUsd,
    vestingSchedule: l.vestingSchedule,
    signingBonusRepaymentMonths: l.signingBonusRepaymentMonths,
    specialTerms: l.specialTerms,
  };
}

const normText = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();

function compareValues(
  log: string | number | null,
  letter: string | number | null,
): FieldState {
  if (log == null && letter == null) return "match";
  if (log == null) return "missing_in_log";
  if (letter == null) return "missing_in_letter";
  if (typeof log === "string" && typeof letter === "string") {
    return normText(log) === normText(letter) ? "match" : "conflict";
  }
  return log === letter ? "match" : "conflict";
}

function fieldDecision(candidateId: string, f: FieldComparison): OfferDecision | undefined {
  if (f.letter == null) return undefined;
  return OFFER_DECISIONS.find(
    (d) =>
      d.kind === "field" &&
      d.candidateId === candidateId &&
      d.field === f.key &&
      normText(String(d.letterValue)) === normText(String(f.letter)),
  );
}

function termDecision(candidateId: string, term: string): OfferDecision | undefined {
  return OFFER_DECISIONS.find(
    (d) => d.kind === "term" && d.candidateId === candidateId && normText(d.term) === normText(term),
  );
}

export function compareOffers(
  offers: OfferLogRow[],
  letters: OfferLetter[],
): OfferComparison[] {
  const letterById = new Map(letters.map((l) => [l.candidateId, l]));

  return offers.map((o) => {
    const logOffer = fromOfferLog(o);
    const letter = letterById.get(o.candidateId);
    if (!letter) {
      return {
        offerId: o.offerId,
        candidateId: o.candidateId,
        candidateName: o.candidateName,
        offerStatus: o.offerStatus,
        letterFile: null,
        fields: [],
        letterOnlyTerms: [],
        approvedTerms: [],
        verification: "No letter",
        normalized: logOffer,
      };
    }

    const letterOffer = fromOfferLetter(letter);
    const compared = OFFER_FIELDS.map((f): FieldComparison => {
      const log = logOffer[f.key];
      const letterValue = letterOffer[f.key];
      const state = compareValues(log, letterValue);
      const base = { ...f, log, letter: letterValue, state };
      if (state === "match") {
        return { ...base, resolution: "Confirmed", rule: null, reconciled: log };
      }
      const accepted = o.offerStatus === "Accepted";
      if (f.kind === "terms") {
        // Signed-letter terms win once the offer is accepted.
        return accepted && letterValue != null
          ? { ...base, resolution: "Auto-corrected", rule: "termsCorrectedFromLetter", reconciled: letterValue }
          : { ...base, resolution: "Needs review", rule: "offerTermsOpen", reconciled: null };
      }
      if (state === "missing_in_log") {
        // Structured-data gap: the letter is the only source, so extract it.
        return accepted
          ? { ...base, resolution: "Populated from letter", rule: "compMissingInLog", reconciled: letterValue }
          : { ...base, resolution: "Needs review", rule: "offerTermsOpen", reconciled: null };
      }
      // Both sources state a value (or the letter omits one): never overwrite comp.
      return { ...base, resolution: "Needs review", rule: "compConflict", reconciled: null };
    });
    const fields = compared.map((f): FieldComparison => {
      const decision = f.resolution === "Needs review" ? fieldDecision(o.candidateId, f) : undefined;
      return decision ? { ...f, resolution: "Confirmed by Ops", rule: null, reconciled: f.letter, decision } : f;
    });
    const logText = normText(o.commissionDetail ?? "");
    const approvedTerms: OfferComparison["approvedTerms"] = [];
    const letterOnlyTerms = letter.specialTerms.filter((t) => {
      if (logText.includes(normText(t.split(": ").at(-1) ?? t))) return false;
      const decision = termDecision(o.candidateId, t);
      if (decision) approvedTerms.push({ term: t, decision });
      return !decision;
    });

    return {
      offerId: o.offerId,
      candidateId: o.candidateId,
      candidateName: o.candidateName,
      offerStatus: o.offerStatus,
      letterFile: letter.fileName,
      fields,
      letterOnlyTerms,
      approvedTerms,
      verification: verificationOf(fields, letterOnlyTerms),
      normalized: {
        ...logOffer,
        ...Object.fromEntries(fields.map((f) => [f.key, f.reconciled])),
        vestingSchedule: letter.vestingSchedule,
        signingBonusRepaymentMonths: letter.signingBonusRepaymentMonths,
        specialTerms: letter.specialTerms,
      },
    };
  });
}
