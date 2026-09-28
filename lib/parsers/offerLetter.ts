// Extracts structured terms from an offer letter's plain text.
// Labels follow the standard letter template ("Base Salary:", "Level:", ...).

import type { OfferLetter } from "@/lib/types";
import { extractOte, isoDate, num, str } from "./values";

export const VARIABLE_COMP_LABELS = [
  "Commission",
  "Performance Bonus",
  "Pipeline Bonus",
  "Hiring Bonus",
] as const;

export const STANDARD_VESTING = "4-year vest, 1-year cliff";

function field(text: string, label: string): string | null {
  const m = text.match(new RegExp(`^\\s*${label}:\\s*(.+)$`, "m"));
  return m ? str(m[1]) : null;
}

export function parseOfferLetter(fileName: string, text: string): OfferLetter {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  // Header block: letter date, then the candidate's full name on the next non-empty line.
  const dateIdx = lines.findIndex((l) => isoDate(l) !== null);
  const letterDate = dateIdx >= 0 ? isoDate(lines[dateIdx]) : null;
  const candidateName =
    dateIdx >= 0 ? (lines.slice(dateIdx + 1).find((l) => l !== "") ?? null) : null;

  const base = field(text, "Base Salary")?.match(/\$([\d,]+)/);
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

  const specialTerms: string[] = [];
  if (vestingSchedule && vestingSchedule !== STANDARD_VESTING) {
    const extra = vestingSchedule.replace(STANDARD_VESTING, "").replace(/^[;,\s]+/, "");
    specialTerms.push(`Vesting: ${extra || vestingSchedule}`);
  }
  if (commissionDetail && /uncapped/i.test(commissionDetail)) {
    specialTerms.push("Commission: uncapped");
  }

  return {
    fileName,
    candidateId: field(text, "Candidate ID"),
    candidateName,
    letterDate,
    role: field(text, "Role"),
    department: field(text, "Department"),
    level: field(text, "Level"),
    location: field(text, "Location"),
    startDate: isoDate(field(text, "Start Date")),
    baseSalaryUsd: base ? num(base[1]) : null,
    bonusTargetPct: bonus ? num(bonus[1]) : null,
    bonusTargetUsd: bonus ? num(bonus[2]) : null,
    commissionPlan,
    commissionDetail,
    oteUsd: extractOte(commissionDetail),
    equityGrantUsd: equity ? num(equity[1]) : noEquity ? 0 : null,
    vestingSchedule,
    signingBonusUsd: signing ? num(signing[1]) : noSigning ? 0 : null,
    specialTerms,
  };
}
