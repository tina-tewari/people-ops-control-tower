// Slack request signing (v0): HMAC-SHA256 of "v0:<timestamp>:<raw body>" with the
// app's signing secret, compared against X-Slack-Signature.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Requests older than this are rejected to block replays. */
export const MAX_SKEW_SECONDS = 300;

export function slackSignature(secret: string, timestamp: string, body: string): string {
  return "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex");
}

export function verifySlackSignature(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) return false;
  const expected = Buffer.from(slackSignature(secret, timestamp, body));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Verifies the request and returns its form fields, or a 401 response. */
export async function readSlackForm(request: Request): Promise<URLSearchParams | Response> {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return Response.json({ error: "SLACK_SIGNING_SECRET is not set" }, { status: 401 });
  const body = await request.text();
  const ok = verifySlackSignature(
    secret,
    request.headers.get("x-slack-request-timestamp"),
    request.headers.get("x-slack-signature"),
    body,
  );
  if (!ok) return Response.json({ error: "Invalid Slack signature" }, { status: 401 });
  return new URLSearchParams(body);
}
