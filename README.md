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
| `app/` | One page per section; `app/api/reconcile` is the scheduled run |

## Scheduled run

`GET /api/reconcile` reruns detection and returns the run report (auto-resolved changes plus each owner's queue).
`vercel.json` schedules it daily; set `CRON_SECRET` in Vercel to require the bearer token. An agent such as
Devin can call the same endpoint daily or weekly and post each owner's items to their channel.
