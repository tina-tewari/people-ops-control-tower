import assert from "node:assert/strict";
import { test } from "node:test";
import { slackSignature, verifySlackSignature } from "./verify";

const secret = "8f742231b10e8888abcd99yyyzzz85a5";
const body = "command=%2Fadd-candidate&trigger_id=123";
const now = 1_790_000_000;
const ts = String(now);

test("accepts a correctly signed, fresh request", () => {
  assert.equal(verifySlackSignature(secret, ts, slackSignature(secret, ts, body), body, now), true);
});

test("rejects a tampered body, wrong secret, or missing headers", () => {
  const sig = slackSignature(secret, ts, body);
  assert.equal(verifySlackSignature(secret, ts, sig, body + "&x=1", now), false);
  assert.equal(verifySlackSignature("other", ts, sig, body, now), false);
  assert.equal(verifySlackSignature(secret, null, sig, body, now), false);
  assert.equal(verifySlackSignature(secret, ts, null, body, now), false);
  assert.equal(verifySlackSignature(secret, ts, "v0=short", body, now), false);
});

test("rejects replays older than five minutes", () => {
  const old = String(now - 301);
  assert.equal(verifySlackSignature(secret, old, slackSignature(secret, old, body), body, now), false);
});
