// The standard offer-letter template. Anything a letter states that differs from
// these values is a non-standard term: the offer log has no column for it, so it
// is surfaced as a special term and routed for review.

export const OFFER_STANDARDS = {
  vestingSchedule: "4-year vest, 1-year cliff",
  basePayFrequency: "bi-weekly",
  signingBonusRepaymentMonths: 12,
  acceptanceWindowBusinessDays: 5,
  benefits: [
    "Medical, dental, and vision coverage (effective first day)",
    "401(k) with 4% company match",
    "Flexible PTO policy",
    "$1,500 annual learning & development stipend",
    "$750 one-time home office stipend",
  ],
  employmentTerms: [
    "This offer is contingent upon satisfactory completion of a background check.",
    "Your employment will be at-will.",
  ],
};
