/**
 * Bearer-token check shared by the reconciliation API routes. Without
 * CRON_SECRET, requests pass unless `requireSecret` is set (write routes).
 */
export function unauthorized(request: Request, opts: { requireSecret?: boolean } = {}): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret && opts.requireSecret) {
    return Response.json({ error: "CRON_SECRET must be set to change reconciliation results" }, { status: 401 });
  }
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
