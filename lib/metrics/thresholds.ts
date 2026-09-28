// Operating thresholds, kept in one place so they can be tuned with leadership.

/** A candidate is stalled once they sit in one stage longer than this. */
export const STALLED_DAYS = 7;

/** Active candidates per open seat. */
export const COVERAGE_HEALTHY = 2;
export const COVERAGE_AT_RISK = 1;

/** Active recruiting stages, in funnel order. */
export const ACTIVE_STAGES = [
  "Applied",
  "Phone Screen",
  "Technical/Assessment",
  "Hiring Manager Interview",
  "Final Round",
  "Offer Extended",
] as const;
