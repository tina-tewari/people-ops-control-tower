// Metric dictionary. Source columns with ambiguous names are renamed at parse
// time; this is the single place their meaning is written down.

export interface MetricDefinition {
  name: string;
  field: string;
  source: string;
  sourceColumn: string;
  definition: string;
  /** True when the source name was ambiguous and has been renamed. */
  renamed: boolean;
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    name: "Offer decision time",
    field: "offerDecisionDays",
    source: "offer_log.csv",
    sourceColumn: "days_to_close",
    definition: "Days from offer extended to the candidate's decision. Measures the offer stage only.",
    renamed: true,
  },
  {
    name: "Recruiting cycle time",
    field: "recruitingCycleDays",
    source: "recruiting_pipeline.csv",
    sourceColumn: "time_to_close_days",
    definition: "Days from application to offer close. Measures the whole recruiting cycle.",
    renamed: true,
  },
  {
    name: "Time to offer",
    field: "applyToOfferDays",
    source: "recruiting_pipeline.csv",
    sourceColumn: "time_to_offer_days",
    definition: "Days from application to offer extended.",
    renamed: true,
  },
  {
    name: "Time to start",
    field: "applyToStartDays",
    source: "recruiting_pipeline.csv",
    sourceColumn: "time_to_start_days",
    definition: "Days from application to the new hire's start date.",
    renamed: true,
  },
  {
    name: "Days in current stage",
    field: "daysInCurrentStage",
    source: "recruiting_pipeline.csv",
    sourceColumn: "days_in_current_stage",
    definition: "Days the candidate has spent in their current stage. Over 7 counts as stalled.",
    renamed: false,
  },
  {
    name: "Pipeline coverage",
    field: "coverage",
    source: "Derived",
    sourceColumn: "—",
    definition: "Active candidates ÷ open seats for a department + level (inferred link).",
    renamed: false,
  },
];
