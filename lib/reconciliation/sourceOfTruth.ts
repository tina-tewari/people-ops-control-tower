// Source-of-truth hierarchy. A deterministic field auto-resolves only when the
// highest-ranked source is corroborated by at least one other source; otherwise
// there is no definitive answer and the owner is pinged.

export type SourceSystem =
  | "Offer letter"
  | "Offer log"
  | "Recruiting pipeline"
  | "People events"
  | "Headcount plan";

export interface FieldPolicy {
  label: string;
  /** Highest authority first. */
  hierarchy: SourceSystem[];
  mode: "Deterministic" | "Human review";
  rule: string;
}

export const FIELD_POLICIES: FieldPolicy[] = [
  {
    label: "Offer date",
    hierarchy: ["Offer letter", "Offer log", "Recruiting pipeline"],
    mode: "Deterministic",
    rule: "Auto-correct when offer letter and offer log agree. Otherwise ping the owner.",
  },
  {
    label: "Role, level, location, start date",
    hierarchy: ["Offer letter", "Offer log", "Recruiting pipeline"],
    mode: "Deterministic",
    rule: "Signed letter wins once the offer is Accepted. Open offers ping the owner.",
  },
  {
    label: "Comp term missing from offer log",
    hierarchy: ["Offer letter", "Offer log"],
    mode: "Deterministic",
    rule: "Extract from the letter and populate the reconciled value; flag as a structured-data gap.",
  },
  {
    label: "Comp term conflicting between log and letter",
    hierarchy: ["Offer letter", "Offer log"],
    mode: "Human review",
    rule: "Never overwritten automatically. Escalate to People Ops.",
  },
  {
    label: "Candidate / offer status",
    hierarchy: ["Offer log", "Recruiting pipeline", "People events"],
    mode: "Human review",
    rule: "Hired vs. Declined/Negotiating changes headcount and payroll. Escalate.",
  },
  {
    label: "Filled seats",
    hierarchy: ["Headcount plan", "People events", "Recruiting pipeline"],
    mode: "Human review",
    rule: "Each filled seat must trace to a hire. Untraceable seats go to Ops review.",
  },
];

export type SourceValues = Partial<Record<SourceSystem, string | null>>;

export interface HierarchyResolution {
  value: string;
  source: SourceSystem;
  corroboratedBy: SourceSystem[];
  dissenting: [SourceSystem, string][];
  basis: string;
}

/** Ranks the sources present, and reports which agree with the top-ranked one. */
export function resolveByHierarchy(
  hierarchy: SourceSystem[],
  values: SourceValues,
): HierarchyResolution | null {
  const ranked = hierarchy.filter((s) => values[s] != null);
  if (ranked.length === 0) return null;
  const [top, ...rest] = ranked;
  const value = values[top]!;
  const corroboratedBy = rest.filter((s) => values[s] === value);
  const dissenting = rest
    .filter((s) => values[s] !== value)
    .map((s): [SourceSystem, string] => [s, values[s]!]);
  const basis = corroboratedBy.length
    ? `${[top, ...corroboratedBy].join(" and ")} agree`
    : `No second source corroborates ${top}`;
  return { value, source: top, corroboratedBy, dissenting, basis };
}
