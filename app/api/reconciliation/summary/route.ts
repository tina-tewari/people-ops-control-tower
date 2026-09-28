import { unauthorized } from "@/lib/reconciliation/auth";
import { runReconciliation } from "@/lib/reconciliation/job";

export function GET(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const run = runReconciliation();
  return Response.json({
    ran_at: run.ran_at,
    dataset: run.dataset,
    summary: run.summary,
    hiring_manager_approvals: run.hiring_manager_approvals,
  });
}
