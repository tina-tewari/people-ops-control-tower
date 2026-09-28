import { getControlTower } from "@/lib/controlTower";
import { formatDate } from "@/lib/format";
import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import { REQ_BACKFILL_DATE, REQUIRED_CANDIDATE_FIELDS, REQUIRED_HEADCOUNT_FIELDS } from "@/lib/data/validate";
import type { MappingConfidence } from "@/lib/reconciliation/requisitions";
import { PriorityText } from "@/components/badges";
import { Callout, Card, InferredTag, Kpi, PageHeader, Pill, Tag, table, type Tone } from "@/components/ui";

const LEVELS = ["L1", "L2", "L3", "L4", "L5"];

const REQ_SCHEMA = [
  ["req_id", "string", "Primary key. Created when headcount is approved; required on every candidate, offer and hire."],
  ["department", "string", "Owning department."],
  ["role", "string", "Job title being hired. One role per requisition."],
  ["level", "string", "L1–L5, validated against the role's allowed levels."],
  ["hiring_manager", "string", "Accountable owner for interview stages."],
  ["target_start_date", "date", "From the headcount plan."],
  ["priority", "enum", "High / Medium / Low."],
  ["status", "enum", "Open / Filled / On hold / Cancelled."],
];

const ROLLOUT = [
  ["Issue req_ids", "Done: every headcount line in the plan now carries a req_id."],
  ["Require it in the ATS", "Block creating a candidate without an open req_id; the role, level and hiring manager come from the req."],
  ["Carry it downstream", "Offer log rows and HRIS hire events store the same req_id, so offer → hire → filled seat is a join, not a guess."],
  ["Backfill legacy candidates", "Done once: every existing candidate got an Inferred req_id with a confidence score. Recruiters confirm the Low-confidence ones."],
];

// Sequential single-hue ramp (light → dark) for candidate counts.
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];

const CONFIDENCE_TONE: Record<MappingConfidence, Tone> = { High: "good", Medium: "warning", Low: "critical" };

export default function DataModelPage() {
  const { reqModel } = getControlTower();
  const ev = reqModel.evidence;
  const singleRoleLines = ev.headcountLines - ev.linesWithMultipleRoles;
  const spread = ev.roleSpread.slice(0, 12);
  const maxCell = Math.max(1, ...spread.flatMap((r) => Object.values(r.byLevel)));

  const BEFORE_AFTER = [
    ["Which approved seat is this candidate for?", `Guess from department + level; ${ev.linesWithMultipleRoles} of ${ev.headcountLines} lines match several roles`, "Exact: candidate.req_id"],
    ["Is this seat covered by the pipeline?", "Coverage counts every candidate at that department + level, whatever the role", "Active candidates per req_id"],
    ["Which hire filled this seat?", `${ev.untracedFilledSeats} filled seats cannot be traced to any hire`, "hire_event.req_id → requisition"],
    ["Who owns the opening?", `${ev.linesWithMultipleManagers} lines have candidates under more than one hiring manager`, "requisition.hiring_manager"],
    ["Time to fill", "Not measurable per seat", "req opened → hire start date"],
  ];

  return (
    <>
      <PageHeader
        title="Data Model Gap"
        description="The headcount plan and recruiting pipeline now share a req_id. Legacy candidates were linked by a one-time inferred backfill (department + level, scored on role, hiring manager and target start date); every candidate added from here on must be entered against a req_id."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Headcount lines with a single role"
          value={`${singleRoleLines} / ${ev.headcountLines}`}
          hint={`Widest: ${ev.maxRolesOnOneLine.reqId} matches ${ev.maxRolesOnOneLine.count} roles`}
          status={singleRoleLines / Math.max(1, ev.headcountLines) < 0.5 ? "critical" : "warning"}
        />
        <Kpi
          label="Roles seen at more than one level"
          value={`${ev.rolesAtMultipleLevels} / ${ev.rolesSeen}`}
          hint="Level cannot stand in for role"
          status={ev.rolesAtMultipleLevels ? "critical" : "good"}
        />
        <Kpi
          label="Active candidates on ambiguous lines"
          value={`${ev.activeOnAmbiguousLines} / ${ev.activeCandidates}`}
          hint="Inferred req_id; recruiter should confirm"
          status={ev.activeOnAmbiguousLines ? "warning" : "good"}
        />
        <Kpi
          label="Recruiting against filled lines"
          value={ev.activeOnFilledLines}
          hint="Active candidates where the plan shows 0 open seats"
          status={ev.activeOnFilledLines ? "warning" : "good"}
          href="/reconciliation"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Callout tone="warning" title={`One-time backfill (${REQ_BACKFILL_DATE})`}>
          Every legacy candidate carries a <code className="rounded bg-surface-2 px-1">req_id</code> picked on{" "}
          <strong>department + level</strong> and labeled <InferredTag />. Its confidence counts how many of role,
          hiring manager and target start date agree with the requisition: <strong>High</strong> {ev.candidateMappings["Inferred High"]},{" "}
          <strong>Medium</strong> {ev.candidateMappings["Inferred Medium"]}, <strong>Low</strong> {ev.candidateMappings["Inferred Low"]}
          {ev.candidateMappings.Unmatched > 0 && <>, <strong>Unmatched</strong> {ev.candidateMappings.Unmatched}</>}. Inferred
          links are a best guess, not a definitive mapping.
        </Callout>
        <Callout tone="info" title="What production should do">
          Make <code className="rounded bg-surface-2 px-1">req_id</code> the spine of the data model: issued when headcount
          is approved, required in the ATS, and carried on offers and hire events. Every inferred join on this site then
          becomes an exact one.
        </Callout>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="The same role is hired at every level"
          subtitle="Candidates per role and level, roles with the widest spread first"
          flush
        >
          <div className={table.wrap}>
            <table className="w-full text-sm">
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>Role</th>
                  {LEVELS.map((l) => <th key={l} className="px-2 py-2.5 text-center font-medium">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {spread.map((r) => (
                  <tr key={r.role} className={table.tr}>
                    <td className="whitespace-nowrap px-4 py-1.5 text-xs">{r.role}</td>
                    {LEVELS.map((l) => {
                      const n = r.byLevel[l] ?? 0;
                      const step = n ? Math.min(RAMP.length - 1, Math.floor((n / maxCell) * (RAMP.length - 1))) : -1;
                      return (
                        <td key={l} className="px-1 py-1">
                          <span
                            title={`${r.role} · ${l}: ${n} candidate${n === 1 ? "" : "s"}`}
                            className={`tabular grid h-7 place-items-center rounded text-xs ${n ? "font-medium" : "text-ink-3"}`}
                            style={n ? { background: RAMP[step], color: step >= 3 ? "#fff" : "#0b0b0b" } : { background: "var(--surface-2)" }}
                          >
                            {n || "·"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-2" title="What a req_id fixes" flush>
          <ul className="divide-y divide-line">
            {BEFORE_AFTER.map(([q, today, fixed]) => (
              <li key={q} className="px-5 py-3 text-sm">
                <p className="font-medium">{q}</p>
                <p className="mt-1 flex gap-2 text-xs text-ink-2">
                  <span className="w-14 shrink-0 text-ink-3">Today</span>{today}
                </p>
                <p className="mt-0.5 flex gap-2 text-xs text-ink-2">
                  <span className="w-14 shrink-0 text-ink-3">req_id</span>
                  <code className="font-mono">{fixed}</code>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Conceptual requisition model" subtitle="One row per approved seat group" flush>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Field</th>
                <th className={table.th}>Type</th>
                <th className={table.th}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {REQ_SCHEMA.map(([f, t, d]) => (
                <tr key={f} className={table.tr}>
                  <td className={`${table.td} font-mono text-xs`}>{f}</td>
                  <td className={`${table.td} text-ink-2`}>{t}</td>
                  <td className={`${table.td} text-ink-2`}>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line px-5 py-3 font-mono text-xs leading-relaxed text-ink-2">
            headcount_plan ─(req_id)→ requisition ─(req_id)→ candidate ─(candidate_id)→ offer ─(req_id)→ hire event
          </div>
        </Card>

        <Card title="Rollout" subtitle="From inferred to exact joins" flush>
          <ol className="divide-y divide-line">
            {ROLLOUT.map(([step, detail], i) => (
              <li key={step} className="flex gap-3 px-5 py-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold">{i + 1}</span>
                <span>
                  <span className="font-medium">{step}</span>
                  <span className="mt-0.5 block text-xs text-ink-2">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card
          title="Adding a candidate: mandatory fields"
          subtitle="recruiting_pipeline.csv. Checked by npm run validate:data."
          flush
        >
          <FieldTable rows={REQUIRED_CANDIDATE_FIELDS} />
        </Card>
        <Card
          title="Adding a headcount line: mandatory fields"
          subtitle="headcount_plan.csv. One line is one requisition."
          flush
        >
          <FieldTable rows={REQUIRED_HEADCOUNT_FIELDS} />
        </Card>
      </div>

      <Card
        className="mt-6"
        title="Requisitions"
        subtitle="One per headcount line. Role and hiring manager are the most common values among the req's candidates."
        flush
      >
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>req_id</th>
                <th className={table.th}>Department</th>
                <th className={table.th}>Level</th>
                <th className={table.th}>Role (matched)</th>
                <th className={table.th}>Hiring manager (matched)</th>
                <th className={table.th}>Target start</th>
                <th className={table.th}>Priority</th>
                <th className={table.th}>Status</th>
                <th className={table.thNum}>Active</th>
                <th className={table.th}>Mapping</th>
              </tr>
            </thead>
            <tbody>
              {reqModel.requisitions.map((r) => (
                <tr key={r.reqId} id={r.reqId} className={`${table.tr} target:bg-accent-soft`}>
                  <td className={`${table.td} whitespace-nowrap font-mono text-xs`}>{r.reqId}</td>
                  <td className={table.td}>{r.department}</td>
                  <td className={table.td}>{r.level}</td>
                  <td className={`${table.td} min-w-48`}>
                    {r.role}
                    {r.matchedRoles.length > 1 && (
                      <p className="cursor-help text-xs text-ink-3" title={r.matchedRoles.slice(1).join(", ")}>
                        +{r.matchedRoles.length - 1} other role{r.matchedRoles.length > 2 ? "s" : ""}
                      </p>
                    )}
                  </td>
                  <td className={`${table.td} min-w-40`}>
                    {r.hiringManager}
                    {r.matchedManagers.length > 1 && (
                      <p className="cursor-help text-xs text-ink-3" title={r.matchedManagers.slice(1).join(", ")}>
                        +{r.matchedManagers.length - 1} other manager{r.matchedManagers.length > 2 ? "s" : ""}
                      </p>
                    )}
                  </td>
                  <td className={`${table.td} whitespace-nowrap`}>{formatDate(r.targetStartDate)}</td>
                  <td className={table.td}><PriorityText priority={r.priority} /></td>
                  <td className={table.td}>
                    <Pill tone={r.status === "Open" ? "info" : "neutral"}>{r.status}</Pill>
                  </td>
                  <td className={table.tdNum}>{r.activeCandidates.length}</td>
                  <td className={table.td}>
                    <span className="flex flex-col items-start gap-1">
                      {r.mapping === "Inferred" ? <InferredTag /> : <Pill tone="good">Confirmed</Pill>}
                      <Pill tone={CONFIDENCE_TONE[r.confidence]}>{r.confidence} confidence</Pill>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        className="mt-6 scroll-mt-6"
        title={<span id="metric-dictionary">Metric dictionary</span>}
        subtitle="The source files use “close” for two different durations. Ambiguous columns are renamed at parse time."
        flush
      >
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Metric</th>
                <th className={table.th}>Source column</th>
                <th className={table.th}>Field in app</th>
                <th className={table.th}>Definition</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_DEFINITIONS.map((m) => (
                <tr key={m.field} className={table.tr}>
                  <td className={`${table.td} whitespace-nowrap font-medium`}>
                    {m.name} {m.renamed && <Tag>Renamed</Tag>}
                  </td>
                  <td className={`${table.td} whitespace-nowrap`}>
                    <code className="font-mono text-xs">{m.sourceColumn}</code>
                    <p className="text-xs text-ink-3">{m.source}</p>
                  </td>
                  <td className={`${table.td} font-mono text-xs`}>{m.field}</td>
                  <td className={`${table.td} text-ink-2`}>{m.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {reqModel.unmapped.length > 0 && (
        <Card className="mt-6" title="Active candidates with no headcount line" subtitle="Recruiting against a department + level the plan does not approve" flush>
          <table className={table.table}>
            <tbody>
              {reqModel.unmapped.map((p) => (
                <tr key={p.candidateId} className={table.tr}>
                  <td className={table.td}>{p.candidateName}</td>
                  <td className={table.td}>{p.role}</td>
                  <td className={table.td}>{p.department} · {p.level}</td>
                  <td className={table.td}>{p.hiringManager}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function FieldTable({ rows }: { rows: { column: string; rule: string }[] }) {
  return (
    <table className={table.table}>
      <tbody>
        {rows.map((f) => (
          <tr key={f.column} className={table.tr}>
            <td className={`${table.td} font-mono text-xs`}>{f.column}</td>
            <td className={`${table.td} text-ink-2`}>{f.rule}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
