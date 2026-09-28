// Read-only view of reconciliation results for the dashboard.
// Filters: ?status=needs_review&owner=People%20Ops&conflict_type=hiredVsDeclined&include_closed=1

import { unauthorized } from "@/lib/reconciliation/auth";
import { runReconciliation } from "@/lib/reconciliation/job";
import { summarize } from "@/lib/reconciliation/results";

export function GET(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const q = new URL(request.url).searchParams;
  const run = runReconciliation();
  const pool = q.get("include_closed") ? [...run.results, ...run.closed] : run.results;
  const results = pool.filter(
    (r) =>
      (!q.get("status") || r.status === q.get("status")) &&
      (!q.get("owner") || r.owner === q.get("owner")) &&
      (!q.get("conflict_type") || r.conflict_type === q.get("conflict_type")) &&
      (!q.get("candidate_id") || r.candidate_id === q.get("candidate_id")),
  );

  return Response.json({
    ran_at: run.ran_at,
    dataset: run.dataset,
    summary: summarize(results),
    results,
  });
}
