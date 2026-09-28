// Weekly offer-letter reconciliation.
//   offer letter → extraction → normalized offer schema → compare against offer log
// Writes a committed snapshot under reports/offers/<dataset>/, diffs it against the
// previous snapshot, appends a CHANGELOG entry, and emits a change note plus the list
// of open questions for #recruiting-ops.
//
// Usage: npm run reconcile:offers -- [--date YYYY-MM-DD] [--note path/to/note.md]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { getDataset } from "@/lib/data/load";
import { compareOffers, type OfferComparison, type OfferVerification } from "@/lib/reconciliation/offers";
import { RULES } from "@/lib/reconciliation/playbook";
import { ROUTING } from "@/config/routing";
import { formatValue } from "@/lib/format";

interface OpenQuestion {
  offerId: string | null;
  candidateId: string | null;
  candidateName: string | null;
  topic: string;
  question: string;
  owner: string;
}

interface OfferSnapshot {
  offerId: string;
  candidateId: string;
  candidateName: string;
  offerStatus: string;
  letterFile: string | null;
  verification: OfferVerification;
  normalized: OfferComparison["normalized"];
  differences: {
    field: string;
    log: string;
    letter: string;
    resolution: string;
    reconciled: string | null;
    decision: string | null;
  }[];
  letterOnlyTerms: string[];
  approvedTerms: { term: string; decision: string }[];
}

interface Snapshot {
  dataset: string;
  asOf: string;
  summary: Record<OfferVerification | "offers" | "orphanLetters" | "openQuestions", number>;
  offers: OfferSnapshot[];
  orphanLetters: { file: string; candidateId: string | null; candidateName: string | null }[];
  openQuestions: OpenQuestion[];
}

const { values: args } = parseArgs({
  options: { date: { type: "string" }, note: { type: "string" } },
});
const runDate = args.date ?? new Date().toISOString().slice(0, 10);
const datasetName = process.env.DATASET ?? "real";
const outDir = path.join(process.cwd(), "reports", "offers", datasetName);
const snapshotPath = path.join(outDir, "offer_reconciliation.json");

function buildSnapshot(): Snapshot {
  const ds = getDataset();
  const comparisons = compareOffers(ds.offers, ds.letters);
  const offerIds = new Set(ds.offers.map((o) => o.candidateId));

  const offers: OfferSnapshot[] = comparisons.map((c) => ({
    offerId: c.offerId,
    candidateId: c.candidateId,
    candidateName: c.candidateName,
    offerStatus: c.offerStatus,
    letterFile: c.letterFile,
    verification: c.verification,
    normalized: c.normalized,
    differences: c.fields
      .filter((f) => f.state !== "match")
      .map((f) => ({
        field: f.label,
        log: formatValue(f.log, f.format),
        letter: formatValue(f.letter, f.format),
        resolution: f.resolution,
        reconciled: f.resolution === "Needs review" ? null : formatValue(f.reconciled, f.format),
        decision: f.decision?.decision ?? null,
      })),
    letterOnlyTerms: c.letterOnlyTerms,
    approvedTerms: c.approvedTerms.map(({ term, decision }) => ({ term, decision: decision.decision })),
  }));

  const orphanLetters = ds.letters
    .filter((l) => !l.candidateId || !offerIds.has(l.candidateId))
    .map((l) => ({ file: l.fileName, candidateId: l.candidateId, candidateName: l.candidateName }));

  const openQuestions: OpenQuestion[] = [
    ...comparisons.flatMap((c) => [
      ...c.fields
        .filter((f) => f.resolution === "Needs review")
        .map((f) => ({
          offerId: c.offerId,
          candidateId: c.candidateId,
          candidateName: c.candidateName,
          topic: f.label,
          question: `${f.label}: offer log has "${formatValue(f.log, f.format)}", offer letter has "${formatValue(f.letter, f.format)}". ${RULES[f.rule!].conflict}. Which is correct?`,
          owner: RULES[f.rule!].ownerRole,
        })),
      ...c.letterOnlyTerms.map((t) => ({
        offerId: c.offerId,
        candidateId: c.candidateId,
        candidateName: c.candidateName,
        topic: "Non-standard term",
        question: `Letter includes a non-standard term the offer log can't capture: "${t}". Was it approved, and where should it be tracked?`,
        owner: RULES.nonStandardOfferTerm.ownerRole,
      })),
    ]),
    ...orphanLetters.map((l) => ({
      offerId: null,
      candidateId: l.candidateId,
      candidateName: l.candidateName,
      topic: "Letter without offer record",
      question: `Offer letter ${l.file} has no matching row in offer_log.csv. Should an offer record be created?`,
      owner: "Recruiting Ops",
    })),
  ];

  const count = (v: OfferVerification) => offers.filter((o) => o.verification === v).length;
  return {
    dataset: datasetName,
    asOf: ds.meta.asOf,
    summary: {
      offers: offers.length,
      Verified: count("Verified"),
      Resolved: count("Resolved"),
      Flagged: count("Flagged"),
      "No letter": count("No letter"),
      orphanLetters: orphanLetters.length,
      openQuestions: openQuestions.length,
    },
    offers,
    orphanLetters,
    openQuestions,
  };
}

const fmt = (v: unknown) => (Array.isArray(v) ? v.join("; ") || "—" : v == null || v === "" ? "—" : String(v));

function diff(prev: Snapshot | null, next: Snapshot): string[] {
  if (!prev) return ["Initial baseline snapshot."];
  const changes: string[] = [];
  const before = new Map(prev.offers.map((o) => [o.offerId, o]));
  const after = new Map(next.offers.map((o) => [o.offerId, o]));

  for (const o of next.offers) {
    const p = before.get(o.offerId);
    const who = `${o.candidateName} (${o.candidateId}, ${o.offerId})`;
    if (!p) {
      changes.push(`New offer ${who}: ${o.verification}.`);
      continue;
    }
    if (p.verification !== o.verification) changes.push(`${who}: ${p.verification} → ${o.verification}.`);
    if (p.letterFile !== o.letterFile) changes.push(`${who}: offer letter ${fmt(p.letterFile)} → ${fmt(o.letterFile)}.`);
    for (const key of Object.keys(o.normalized) as (keyof OfferSnapshot["normalized"])[]) {
      const a = fmt(p.normalized[key]);
      const b = fmt(o.normalized[key]);
      if (a !== b) changes.push(`${who}: ${key} ${a} → ${b}.`);
    }
    for (const t of o.letterOnlyTerms.filter((t) => !p.letterOnlyTerms.includes(t))) {
      changes.push(`${who}: new non-standard term "${t}".`);
    }
    for (const t of p.letterOnlyTerms.filter((t) => !o.letterOnlyTerms.includes(t))) {
      changes.push(`${who}: non-standard term cleared "${t}".`);
    }
    for (const d of o.differences.filter((d) => d.decision)) {
      const was = p.differences.find((x) => x.field === d.field);
      if (was?.decision !== d.decision) changes.push(`${who}: ${d.field} confirmed by Recruiting Ops — ${d.decision}`);
    }
    for (const a of o.approvedTerms.filter((a) => !(p.approvedTerms ?? []).some((x) => x.term === a.term))) {
      changes.push(`${who}: non-standard term "${a.term}" approved by Recruiting Ops — ${a.decision}`);
    }
  }
  for (const p of prev.offers) {
    if (!after.has(p.offerId)) changes.push(`Offer ${p.candidateName} (${p.candidateId}, ${p.offerId}) removed from offer log.`);
  }
  const prevOrphans = new Set(prev.orphanLetters.map((l) => l.file));
  for (const l of next.orphanLetters.filter((l) => !prevOrphans.has(l.file))) {
    changes.push(`Offer letter ${l.file} has no offer-log record.`);
  }
  return changes;
}

function questionLines(qs: OpenQuestion[]): string[] {
  return qs.map(
    (q) => `- **${q.candidateName ?? "Unknown"}** (${[q.candidateId, q.offerId].filter(Boolean).join(", ")}) — ${q.question} _Owner: ${q.owner}_`,
  );
}

function summaryLine(s: Snapshot["summary"]): string {
  return `${s.offers} offers · ${s.Verified} verified · ${s.Resolved} resolved from letter · ${s.Flagged} flagged · ${s["No letter"]} without a letter · ${s.openQuestions} open questions`;
}

function report(s: Snapshot): string {
  const rows = s.offers
    .filter((o) => o.letterFile)
    .map((o) => `| ${o.candidateName} | ${o.candidateId} | ${o.offerStatus} | ${o.verification} | ${o.differences.map((d) => `${d.field}: ${d.resolution}`).join("; ") || "—"} | ${[...o.letterOnlyTerms, ...o.approvedTerms.map((a) => `${a.term} (approved)`)].join("; ") || "—"} |`);
  const decisions = s.offers.flatMap((o) => [
    ...o.differences.filter((d) => d.decision).map((d) => `- **${o.candidateName}** (${o.candidateId}) — ${d.field}: ${d.decision}`),
    ...o.approvedTerms.map((a) => `- **${o.candidateName}** (${o.candidateId}) — "${a.term}": ${a.decision}`),
  ]);
  return [
    `# Offer reconciliation — ${s.dataset}`,
    "",
    `Data as of ${s.asOf}. Runs ${ROUTING.schedule.label}; open questions go to ${ROUTING.offerReviewChannel}.`,
    "",
    summaryLine(s.summary),
    "",
    "## Offers with a letter on file",
    "",
    "| Candidate | ID | Offer status | Verification | Differences vs. offer log | Non-standard terms |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Recruiting Ops decisions applied",
    "",
    ...(decisions.length ? decisions : ["None."]),
    "",
    `## Open questions for ${ROUTING.offerReviewChannel}`,
    "",
    ...(s.openQuestions.length ? questionLines(s.openQuestions) : ["None."]),
    "",
  ].join("\n");
}

const prev: Snapshot | null = existsSync(snapshotPath) ? JSON.parse(readFileSync(snapshotPath, "utf8")) : null;
const next = buildSnapshot();
const changes = diff(prev, next);

mkdirSync(outDir, { recursive: true });
writeFileSync(snapshotPath, `${JSON.stringify(next, null, 2)}\n`);
writeFileSync(path.join(outDir, "REPORT.md"), report(next));

const note = [
  `## ${runDate} — offer reconciliation (${datasetName})`,
  "",
  summaryLine(next.summary),
  "",
  "### Changes since last run",
  "",
  ...(changes.length ? changes.map((c) => `- ${c}`) : ["- No changes."]),
  "",
  `### Open questions (${ROUTING.offerReviewChannel})`,
  "",
  ...(next.openQuestions.length ? questionLines(next.openQuestions) : ["- None."]),
  "",
].join("\n");

if (changes.length) {
  const changelogPath = path.join(outDir, "CHANGELOG.md");
  const header = "# Offer reconciliation changelog\n\n";
  const existing = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8").replace(header, "") : "";
  writeFileSync(changelogPath, `${header}${note}\n${existing}`);
}
if (args.note) writeFileSync(args.note, note);

console.log(note);
console.log(`CHANGED=${changes.length > 0}`);
