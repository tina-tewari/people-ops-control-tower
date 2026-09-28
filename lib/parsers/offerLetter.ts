// Extracts structured terms from an offer letter's plain text.
// Labels follow the standard letter template ("Base Salary:", "Level:", ...).

import type { OfferLetter } from "@/lib/types";
import { OFFER_STANDARDS } from "@/config/offerStandards";
import { extractOte, isoDate, num, str } from "./values";

export const VARIABLE_COMP_LABELS = [
  "Commission",
  "Performance Bonus",
  "Pipeline Bonus",
  "Hiring Bonus",
] as const;

export const STANDARD_VESTING = OFFER_STANDARDS.vestingSchedule;

/** Every "Label:" the standard template uses; any other label is a non-standard term. */
const KNOWN_LABELS = new Set<string>([
  "Role",
  "Candidate ID",
  "Department",
  "Level",
  "Location",
  "Start Date",
  "Base Salary",
  "Annual Bonus Target",
  ...VARIABLE_COMP_LABELS,
  "Equity Grant",
  "Vesting Schedule",
]);

const RULE = /^[─—-]{5,}$/;

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function field(text: string, label: string): string | null {
  const m = text.match(new RegExp(`^\\s*${label}:\\s*(.+)$`, "m"));
  return m ? str(m[1]) : null;
}

/** Non-empty lines between a "── HEADING ──" block and the next rule line (or sign-off). */
function section(lines: string[], heading: string): string[] {
  const start = lines.findIndex((l, i) => l === heading && RULE.test(lines[i + 1] ?? ""));
  if (start < 0) return [];
  const body: string[] = [];
  for (const l of lines.slice(start + 2)) {
    if (RULE.test(l) || /^Sincerely,?$/.test(l)) break;
    if (l !== "") body.push(l);
  }
  return body;
}

/** Joins wrapped lines into sentences ("...subject to" + "company and ..." → one line). */
function sentences(lines: string[]): string[] {
  return lines
    .join(" ")
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();

export function parseOfferLetter(fileName: string, text: string): OfferLetter {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  // Header block: letter date, then the candidate's full name on the next non-empty line.
  const dateIdx = lines.findIndex((l) => isoDate(l) !== null);
  const letterDate = dateIdx >= 0 ? isoDate(lines[dateIdx]) : null;
  const candidateName =
    dateIdx >= 0 ? (lines.slice(dateIdx + 1).find((l) => l !== "") ?? null) : null;
  const hiringManager = str(text.match(/reporting to ([^.\n]+)\./)?.[1]);

  const baseLine = field(text, "Base Salary");
  const base = baseLine?.match(/\$([\d,]+)/);
  const basePayFrequency = str(baseLine?.match(/paid\s+([\w-]+)/i)?.[1]);
  const bonus = text.match(/Annual Bonus Target:\s*([\d.]+)%[^($]*\(\$([\d,]+)\)/);

  let commissionPlan: string | null = null;
  let commissionDetail: string | null = null;
  for (const label of VARIABLE_COMP_LABELS) {
    const detail = field(text, label);
    if (detail) {
      commissionPlan = label;
      commissionDetail = detail;
      break;
    }
  }

  const equity = field(text, "Equity Grant")?.match(/\$([\d,]+)/);
  const noEquity = /No equity grant/i.test(text);
  const vestingSchedule = field(text, "Vesting Schedule");
  const signing = text.match(/\$([\d,]+)\s+one-time signing bonus/i);
  const noSigning = /No signing bonus/i.test(text);
  const repayment = text.match(/(\d+)-month repayment obligation/i);
  const signingBonusRepaymentMonths = repayment ? num(repayment[1]) : null;

  const benefits = section(lines, "BENEFITS").map((l) => l.replace(/^[•*-]\s*/, ""));
  const employmentSentences = sentences(section(lines, "EMPLOYMENT TERMS"));
  const acceptance = employmentSentences
    .map((s) => s.match(/within\s+(\w+)\s*(?:\((\d+)\))?\s+business days/i))
    .find((m) => m);
  const acceptanceWindowBusinessDays = acceptance
    ? (num(acceptance[2]) ?? WORDS[acceptance[1].toLowerCase()] ?? num(acceptance[1]))
    : null;
  const employmentTerms = employmentSentences.filter(
    (s) => !/countersign|Questions\?|look forward/i.test(s),
  );

  const specialTerms: string[] = [];
  if (vestingSchedule && vestingSchedule !== STANDARD_VESTING) {
    const extra = vestingSchedule.replace(STANDARD_VESTING, "").replace(/^[;,\s]+/, "");
    specialTerms.push(`Vesting: ${extra || vestingSchedule}`);
  }
  if (commissionDetail && /uncapped/i.test(commissionDetail)) {
    specialTerms.push("Commission: uncapped");
  }
  if (basePayFrequency && norm(basePayFrequency) !== OFFER_STANDARDS.basePayFrequency) {
    specialTerms.push(`Base pay frequency: ${basePayFrequency}`);
  }
  if (signing && signingBonusRepaymentMonths !== OFFER_STANDARDS.signingBonusRepaymentMonths) {
    specialTerms.push(
      signingBonusRepaymentMonths == null
        ? "Signing bonus: no repayment obligation"
        : `Signing bonus: ${signingBonusRepaymentMonths}-month repayment obligation`,
    );
  }
  const standardBenefits = new Set(OFFER_STANDARDS.benefits.map(norm));
  for (const b of benefits) {
    if (!standardBenefits.has(norm(b))) specialTerms.push(`Benefit: ${b}`);
  }
  const standardTerms = new Set(OFFER_STANDARDS.employmentTerms.map(norm));
  for (const t of employmentTerms) {
    if (!standardTerms.has(norm(t)) && !/business days/i.test(t)) specialTerms.push(`Employment term: ${t}`);
  }
  if (
    acceptanceWindowBusinessDays != null &&
    acceptanceWindowBusinessDays !== OFFER_STANDARDS.acceptanceWindowBusinessDays
  ) {
    specialTerms.push(`Acceptance window: ${acceptanceWindowBusinessDays} business days`);
  }
  for (const m of text.matchAll(/^\s*([A-Z][A-Za-z0-9 &/()-]{1,40}):\s+(.+)$/gm)) {
    if (!KNOWN_LABELS.has(m[1].trim())) specialTerms.push(`${m[1].trim()}: ${m[2].trim()}`);
  }

  return {
    fileName,
    candidateId: field(text, "Candidate ID"),
    candidateName,
    letterDate,
    hiringManager,
    role: field(text, "Role"),
    department: field(text, "Department"),
    level: field(text, "Level"),
    location: field(text, "Location"),
    startDate: isoDate(field(text, "Start Date")),
    baseSalaryUsd: base ? num(base[1]) : null,
    basePayFrequency,
    bonusTargetPct: bonus ? num(bonus[1]) : null,
    bonusTargetUsd: bonus ? num(bonus[2]) : null,
    commissionPlan,
    commissionDetail,
    oteUsd: extractOte(commissionDetail),
    equityGrantUsd: equity ? num(equity[1]) : noEquity ? 0 : null,
    vestingSchedule,
    signingBonusUsd: signing ? num(signing[1]) : noSigning ? 0 : null,
    signingBonusRepaymentMonths,
    benefits,
    employmentTerms,
    acceptanceWindowBusinessDays,
    specialTerms,
  };
}
