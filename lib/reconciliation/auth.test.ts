import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { unauthorized } from "./auth";

const req = (auth?: string) =>
  new Request("http://localhost/api", { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  delete process.env.CRON_SECRET;
});

test("write routes are refused when CRON_SECRET is unset", () => {
  assert.equal(unauthorized(req())?.status, undefined);
  assert.equal(unauthorized(req(), { requireSecret: true })?.status, 401);
});

test("the bearer token is checked when CRON_SECRET is set", () => {
  process.env.CRON_SECRET = "s3cret";
  assert.equal(unauthorized(req(), { requireSecret: true })?.status, 401);
  assert.equal(unauthorized(req("Bearer s3cret"), { requireSecret: true }), null);
});
