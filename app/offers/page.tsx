import { getControlTower } from "@/lib/controlTower";
import { OFFER_FIELDS } from "@/lib/reconciliation/offers";
import { formatValue } from "@/lib/format";
import { FieldResolutionBadge, FieldStateBadge, VerificationBadge } from "@/components/badges";
import { Callout, Card, FilterBar, Kpi, PageHeader, Pill, Tag, table } from "@/components/ui";

export default async function OffersPage({ searchParams }: PageProps<"/offers">) {
  const { show = "issues" } = (await searchParams) as { show?: string };
  const { offerComparisons } = getControlTower();

  const withLetter = offerComparisons.filter((c) => c.letterFile);
  const fields = withLetter.flatMap((c) => c.fields);
  const missing = fields.filter((f) => f.state === "missing_in_log").length;
  const conflicts = fields.filter((f) => f.state === "conflict" || f.state === "missing_in_letter").length;
  const letterOnly = withLetter.reduce((n, c) => n + c.letterOnlyTerms.length, 0);
  const verified = withLetter.filter((c) => c.verification !== "Flagged").length;
  const cards = withLetter.filter(
    (c) => show === "all" || c.fields.some((f) => f.state !== "match") || c.letterOnlyTerms.length,
  );

  return (
    <>
      <PageHeader
        title="Offer Reconciliation"
        description="Structured offer-log fields compared with terms extracted from each offer letter, normalized into one offer schema."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Letters verified or resolved" value={`${verified} / ${withLetter.length}`} hint={`${withLetter.length} of ${offerComparisons.length} offers have a letter on file`} status={verified === withLetter.length ? "good" : "warning"} />
        <Kpi label="Fields missing in offer log" value={missing} hint="Structured-data gaps" status={missing ? "warning" : "good"} />
        <Kpi label="Conflicting values" value={conflicts} hint="Escalated, never overwritten" status={conflicts ? "critical" : "good"} />
        <Kpi label="Letter-only special terms" value={letterOnly} status={letterOnly ? "info" : "good"} />
      </div>

      <div className="mt-6">
        <Callout title="Compensation is never overwritten on ambiguity">
          When a comp term is <strong>missing</strong> from the offer log on an accepted offer, the value is extracted from
          the signed letter and populated as the reconciled value, flagged as a structured-data gap. When both
          sources state a value and they <strong>disagree</strong>, or the offer is still open, the field is left
          blank in the reconciled record and escalated to People Ops.
        </Callout>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Offer-by-offer comparison</h2>
        <FilterBar
          active={show}
          options={[
            { key: "issues", label: "With issues", href: "/offers" },
            { key: "all", label: "All with letters", href: "/offers?show=all" },
          ]}
        />
      </div>

      <div className="mt-3 space-y-6">
        {cards.map((c) => (
          <Card
            key={c.offerId}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {c.candidateName}
                <span className="text-xs font-normal text-ink-3">{c.candidateId} · {c.offerId}</span>
              </span>
            }
            subtitle={<>Letter: {c.letterFile}</>}
            action={
              <span className="flex items-center gap-2">
                <VerificationBadge verification={c.verification} />
                <Pill tone={c.offerStatus === "Accepted" ? "good" : c.offerStatus === "Declined" ? "critical" : "warning"}>
                  {c.offerStatus}
                </Pill>
              </span>
            }
            flush
          >
            {c.letterOnlyTerms.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-xs">
                <span className="font-medium">Non-standard terms only in offer letter:</span>
                {c.letterOnlyTerms.map((t) => <Tag key={t}>{t}</Tag>)}
              </div>
            )}
            {c.approvedTerms.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-xs">
                <span className="font-medium">Non-standard terms approved by Recruiting Ops:</span>
                {c.approvedTerms.map(({ term, decision }) => (
                  <span key={term} className="flex items-center gap-1">
                    <Tag>{term}</Tag>
                    <span className="text-ink-3">{decision.decision}</span>
                  </span>
                ))}
              </div>
            )}
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.thead}>
                  <tr>
                    <th className={table.th}>Field</th>
                    <th className={table.th}>Offer log</th>
                    <th className={table.th}>Offer letter</th>
                    <th className={table.th}>Comparison</th>
                    <th className={table.th}>Reconciled value</th>
                    <th className={table.th}>Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {c.fields.map((f) => (
                    <tr key={f.key} className={`${table.tr} ${f.state === "match" ? "text-ink-2" : ""}`}>
                      <td className={`${table.td} whitespace-nowrap font-medium`}>
                        {f.label}
                        <p className="text-xs font-normal text-ink-3">{f.kind === "compensation" ? "Compensation" : "Terms"}</p>
                      </td>
                      <td className={`${table.td} max-w-72`}>{formatValue(f.log, f.format)}</td>
                      <td className={`${table.td} max-w-72`}>{formatValue(f.letter, f.format)}</td>
                      <td className={table.td}><FieldStateBadge state={f.state} /></td>
                      <td className={`${table.td} max-w-72 font-medium`}>
                        {f.resolution === "Needs review" ? <span className="font-normal text-ink-3">Pending review</span> : formatValue(f.reconciled, f.format)}
                      </td>
                      <td className={table.td}><FieldResolutionBadge resolution={f.resolution} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6" title="Normalized offer schema" subtitle="One row per offer. Blank = pending review or not on file." flush>
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Candidate</th>
                {OFFER_FIELDS.filter((f) => f.key !== "commissionDetail").map((f) => (
                  <th key={f.key} className={f.format === "usd" || f.format === "pct" ? table.thNum : table.th}>{f.label}</th>
                ))}
                <th className={table.th}>Vesting</th>
                <th className={table.th}>Special terms</th>
                <th className={table.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {offerComparisons.map((c) => (
                <tr key={c.offerId} className={table.tr}>
                  <td className={`${table.td} whitespace-nowrap font-medium`}>{c.candidateName}</td>
                  {OFFER_FIELDS.filter((f) => f.key !== "commissionDetail").map((f) => (
                    <td key={f.key} className={`${f.format === "usd" || f.format === "pct" ? table.tdNum : table.td} whitespace-nowrap`}>
                      {formatValue(c.normalized[f.key], f.format)}
                    </td>
                  ))}
                  <td className={`${table.td} whitespace-nowrap text-xs`}>{c.normalized.vestingSchedule ?? "—"}</td>
                  <td className={`${table.td} text-xs`}>{c.normalized.specialTerms.join("; ") || "—"}</td>
                  <td className={table.td}><VerificationBadge verification={c.verification} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
