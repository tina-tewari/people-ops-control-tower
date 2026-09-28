// Human status changes: PATCH { "status": "resolved" | "ignored" | "needs_review", "by": "name" }.
// Decisions persist across weekly runs until the conflicting values change.

import { unauthorized } from "@/lib/reconciliation/auth";
import { ResultNotFoundError, setResultStatus } from "@/lib/reconciliation/job";
import type { ResultStatus } from "@/lib/reconciliation/results";

const SETTABLE: ResultStatus[] = ["resolved", "ignored", "needs_review"];

export async function PATCH(request: Request, ctx: RouteContext<"/api/reconciliation/results/[id]">) {
  const denied = unauthorized(request, { requireSecret: true });
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { status?: string; by?: string } | null;
  const status = SETTABLE.find((s) => s === body?.status);
  if (!status) {
    return Response.json({ error: `status must be one of ${SETTABLE.join(", ")}` }, { status: 400 });
  }

  try {
    const result = setResultStatus(decodeURIComponent(id), status, { by: body?.by });
    return Response.json({ result });
  } catch (e) {
    if (e instanceof ResultNotFoundError) {
      return Response.json({ error: `No reconciliation result ${id}; run /api/reconcile first.` }, { status: 404 });
    }
    throw e;
  }
}
