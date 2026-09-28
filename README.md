# People Ops Control Tower

One source of truth for headcount, recruiting and offers. The app loads the recruiting pipeline, headcount plan,
offer log, people events and offer letters, reconciles them against a source-of-truth hierarchy, and routes
every conflict to an owner.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
```

Data is read from `data/<DATASET>/`. The default is `real` (the take-home dataset). `DATASET=sample npm run dev`
runs against the small placeholder set in `data/sample/`, which exercises every reconciliation rule.

## Layout

| Path | Purpose |
|---|---|
| `lib/parsers/` | CSV parser, typed source mappers, offer-letter text extractor |
| `lib/reconciliation/playbook.ts` | Conflict → system action (Auto-correct, Populate, Escalate, Flag, Ping) |
| `lib/reconciliation/sourceOfTruth.ts` | Field hierarchy; auto-resolve only when a second source corroborates |
| `lib/reconciliation/discrepancies.ts` | Detection rules across systems |
| `lib/reconciliation/offers.ts` | Normalized offer schema, offer log vs. offer letter comparison |
| `lib/reconciliation/requisitions.ts` | Inferred requisition model (department + level; no req_id upstream) |
| `lib/reconciliation/actions.ts` | Per-owner action queue (discrepancies + stalled candidates) |
| `lib/metrics/` | Headcount risk, recruiting bottlenecks, overview KPIs, thresholds |
| `config/routing.ts` | Owners, channels, schedule, which stages the hiring manager owns |
| `config/offerStandards.ts` | Standard offer-letter template; anything else is flagged as a non-standard term |
| `scripts/reconcile-offers.ts` | Weekly offer-letter reconciliation; writes `reports/offers/<dataset>/` |
| `app/` | One page per section; `app/api/reconcile` is the scheduled run |

## Scheduled run

`GET /api/reconcile` reruns detection and returns the run report (auto-resolved changes plus each owner's queue).
`vercel.json` schedules it weekly (Mondays 13:00 UTC); set `CRON_SECRET` in Vercel to require the bearer token.

## Weekly offer-letter reconciliation

Offer letter → extraction → normalized offer schema → compare against offer log.

```bash
npm run reconcile:offers -- --date 2026-09-28 --note /tmp/offer-note.md
```

- **Extraction** (`lib/parsers/offerLetter.ts`) pulls role, department, level, hiring manager, location, start
  date, base salary and pay frequency, bonus, commission/variable plan, OTE, equity and vesting, signing bonus and
  repayment terms, benefits, employment terms, and acceptance window. Anything that deviates from
  `config/offerStandards.ts` (or any unrecognized `Label:` line) becomes a special term.
- **Comparison** (`lib/reconciliation/offers.ts`) marks each offer **Verified** (all fields match), **Resolved**
  (accepted offer; terms corrected / missing comp populated from the signed letter), or **Flagged** (comp
  conflict, open offer, or a non-standard term the offer log can't hold). Compensation is never overwritten.
- **Output**: `reports/offers/<dataset>/offer_reconciliation.json` (normalized snapshot), `REPORT.md`, and a
  dated `CHANGELOG.md` entry whenever the snapshot changes. `--note` writes the same change note for the PR.
- **Weekly run**: a Devin automation runs the script every Monday, opens a PR with the updated report and the
  change note, and asks every open question in `#recruiting-ops` on Slack.
