import type { RiskStatus } from "@/lib/metrics/headcount";
import type { SystemAction, ResolutionType } from "@/lib/reconciliation/playbook";
import type { FieldResolution, FieldState } from "@/lib/reconciliation/offers";
import { Pill, type Tone } from "./ui";

const RISK_TONE: Record<RiskStatus, Tone> = { Healthy: "good", "At Risk": "warning", Critical: "critical" };
export const RiskBadge = ({ risk }: { risk: RiskStatus }) => <Pill tone={RISK_TONE[risk]}>{risk}</Pill>;

const ACTION_TONE: Record<SystemAction, Tone> = {
  "Auto-correct": "good",
  "Populate reconciled value": "good",
  Escalate: "critical",
  "Flag for Ops review": "serious",
  "Ping hiring manager": "warning",
  "Ping owner": "warning",
};
export const ActionBadge = ({ action }: { action: SystemAction }) => (
  <Pill tone={ACTION_TONE[action]}>{action}</Pill>
);

export const ResolutionBadge = ({ resolution }: { resolution: ResolutionType }) => (
  <Pill tone={resolution === "Auto-resolvable" ? "good" : "serious"}>
    {resolution === "Auto-resolvable" ? "A · Auto-resolvable" : "B · Human review"}
  </Pill>
);

const FIELD_STATE: Record<FieldState, { tone: Tone; label: string }> = {
  match: { tone: "good", label: "Match" },
  missing_in_log: { tone: "warning", label: "Missing in log" },
  missing_in_letter: { tone: "warning", label: "Not in letter" },
  conflict: { tone: "critical", label: "Conflict" },
};
export const FieldStateBadge = ({ state }: { state: FieldState }) => (
  <Pill tone={FIELD_STATE[state].tone}>{FIELD_STATE[state].label}</Pill>
);

const FIELD_RESOLUTION: Record<FieldResolution, Tone> = {
  Confirmed: "good",
  "Auto-corrected": "good",
  "Populated from letter": "info",
  "Needs review": "serious",
};
export const FieldResolutionBadge = ({ resolution }: { resolution: FieldResolution }) => (
  <Pill tone={FIELD_RESOLUTION[resolution]}>{resolution}</Pill>
);

export const PriorityText = ({ priority }: { priority: string }) => (
  <span className={priority === "High" ? "font-medium text-ink" : "text-ink-2"}>{priority}</span>
);
