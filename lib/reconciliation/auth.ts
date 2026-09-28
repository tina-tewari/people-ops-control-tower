/** Bearer-token check shared by the reconciliation API routes. */
export function unauthorized(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
