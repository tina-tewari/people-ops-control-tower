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
| `lib/reconciliation/requisitions.ts` | Requisition model keyed by `req_id`; one-time inferred backfill for legacy candidates |
| `lib/data/validate.ts` | Mandatory fields for headcount lines and new candidates (`npm run validate:data`) |
| `lib/reconciliation/actions.ts` | Per-owner action queue (discrepancies + stalled candidates) |
| `lib/reconciliation/results.ts` | Public result schema (`ReconciliationResult`) and summary |
| `lib/reconciliation/job.ts` | Scheduled job: detect → merge with stored status history → persist; HM approvals |
| `lib/reconciliation/store.ts` | JSON state file (`.reconciliation/<DATASET>.json`, or `RECONCILIATION_STATE_PATH`) |
| `lib/reconciliation/digest.ts` | Slack digest (hiring-manager approvals + team queues) |
| `lib/slack/` | `/add-candidate` Slack intake: request signing, modal, PR via GitHub API |
| `lib/metrics/` | Headcount risk, recruiting bottlenecks, overview KPIs, thresholds |
| `config/routing.ts` | Owners per rule (fallback People Ops), channels, schedule, hiring-manager stages |
| `config/offerStandards.ts` | Standard offer-letter template; anything else is flagged as a non-standard term |
| `scripts/reconcile-offers.ts` | Weekly offer-letter reconciliation; writes `reports/offers/<dataset>/` |
| `app/` | One page per section; `app/api/reconcile` is the scheduled run |

## Requisition IDs

The headcount plan and recruiting pipeline are joined on `req_id`. Upstream systems had no shared requisition ID, so
`npm run backfill:req-ids` did a **one-time backfill** (2026-09-28) of `data/real/` and `data/sample/`:

- `headcount_plan.csv` gained `req_id` (one per department + level line, e.g. `REQ-ENG-L4`).
- `recruiting_pipeline.csv` gained `req_id`, `req_mapping`, `req_confidence`, `req_match_basis`. Every legacy candidate
  is `req_mapping=Inferred`: the req is picked on department + level, then role, hiring manager and target start date
  are compared with the requisition. All three agree: **High**; two: **Medium**; one or none: **Low**.
  `req_match_basis` lists the fields that agreed. Inferred links are a best guess, not a definitive mapping; a recruiter
  confirms one by setting `req_mapping=Confirmed`. Candidates whose department + level has no line are `Unmatched`.

The long-term fix is structural: issue the `req_id` when headcount is approved and require it in the ATS, the offer
log and HRIS hire events.

### Adding a candidate to the pipeline

Every new row in `recruiting_pipeline.csv` must be entered against an existing requisition. `Inferred` / `Unmatched`
are reserved for the backfill.

| Column | Rule |
|---|---|
| `candidate_id` | Unique |
| `candidate_name` | Full name |
| `req_id` | An existing `req_id` from `headcount_plan.csv` |
| `req_mapping` | `Confirmed` |
| `role` | Job title being hired |
| `department`, `level` | Must equal the requisition's |
| `hiring_manager` | Accountable owner for interview stages |
| `source` | Referral, LinkedIn, Agency, … |
| `applied_date` | `YYYY-MM-DD` |
| `current_stage` | Current pipeline stage |
| `disposition` | Active / Hired / Rejected / Withdrew |
| `rejection_reason` | Required when `disposition` is Rejected |

A new headcount line needs `req_id` (unique), `department`, `level`, `approved_headcount`, `filled_seats`,
`open_seats`, `target_start_date`, `annual_budget_usd` and `priority`. The rules live in `lib/data/validate.ts`;
check them with:

```bash
npm run validate:data              # DATASET=sample for the sample set; exits non-zero on any issue
```

### Adding a candidate from Slack

`/add-candidate` opens a form with the fields above. The requisition is a dropdown of `req_id`s with open seats, and
department and level are filled in from it. The submission is checked against the same rules as `npm run validate:data`
(problems show inline in the form), then a PR is opened that appends one `Confirmed` row to
`data/$DATASET/recruiting_pipeline.csv`. The submitter gets the PR link in Slack. The row lands when the PR is merged.

Setup:

1. Create a Slack app from `slack/manifest.yml` (replace `YOUR-DEPLOYMENT` with the app's host) and install it.
2. Set these on the deployment:

| Variable | Value |
|---|---|
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information → Signing Secret |
| `SLACK_BOT_TOKEN` | Slack app → OAuth & Permissions → Bot User OAuth Token (`xoxb-…`) |
| `GITHUB_TOKEN` | Fine-grained token on this repo with Contents and Pull requests: read and write |
| `GITHUB_REPO` | Optional, default `tina-tewari/people-ops-control-tower` |
| `GITHUB_BASE_BRANCH` | Optional, default `main` |

Anyone in the workspace can submit; review of the PR is the approval step.

## Scheduled run

```bash
npm run reconcile                # run, persist status history, print JSON report
npm run reconcile -- --digest    # same, print the Slack digest instead
npm run reconcile -- --dry-run   # don't write state
npm run reconcile -- --post      # also post the digest to SLACK_WEBHOOK_URL
```

`GET /api/reconcile` does the same over HTTP (and posts the digest when `SLACK_WEBHOOK_URL` is set). `vercel.json`
schedules it weekly (Mondays 13:00 UTC); set `CRON_SECRET` to require the bearer token on every reconciliation route. The `PATCH`
endpoint refuses all requests until `CRON_SECRET` is set. On Vercel, state defaults to the function's temp dir, which
does not persist between invocations; set `RECONCILIATION_STATE_PATH` to durable storage to keep decisions.

Runs are idempotent: result ids are stable (`rule:subject:field`), `detected_at` is kept from the first run that saw
the conflict, and `resolved` / `ignored` decisions stick until the conflicting values change (for stalls, the stage, not the
growing day count). Open conflicts that
disappear from the sources are closed as `resolved`.

| Endpoint | Returns |
|---|---|
| `GET /api/reconciliation/results` | `{ summary, results }`; filters `status`, `owner`, `conflict_type`, `candidate_id`, `include_closed` |
| `GET /api/reconciliation/summary` | `{ summary, hiring_manager_approvals }` |
| `PATCH /api/reconciliation/results/:id` | Body `{ "status": "resolved" \| "ignored" \| "needs_review", "by": "name" }` |

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
