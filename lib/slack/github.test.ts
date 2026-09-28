import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { parseCsv } from "@/lib/parsers/csv";
import type { ViewState } from "./addCandidate";
import { openCandidatePullRequest, repoConfig } from "./github";

const file = (name: string) => readFileSync(path.join(process.cwd(), "data", "sample", name), "utf8");
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const reqId = parseCsv(file("headcount_plan.csv")).find((h) => Number(h.open_seats) > 0)!.req_id;

const state = (name: string): ViewState => ({
  candidate_name: { candidate_name: { value: name } },
  req_id: { req_id: { selected_option: { value: reqId } } },
  role: { role: { value: "Engineer" } },
  hiring_manager: { hiring_manager: { value: "Taylor Reed" } },
  source: { source: { selected_option: { value: "Referral" } } },
  applied_date: { applied_date: { selected_date: "2026-10-01" } },
  current_stage: { current_stage: { selected_option: { value: "Applied" } } },
  disposition: { disposition: { selected_option: { value: "Active" } } },
  rejection_reason: { rejection_reason: { value: null } },
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function fakeGitHub() {
  const calls: { method: string; url: string; body: Record<string, string> | null }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : null });
    const json = (v: object) => new Response(JSON.stringify(v), { status: 200 });
    if (url.includes("/contents/data/sample/headcount_plan.csv")) return json({ content: b64(file("headcount_plan.csv")), sha: "h1" });
    if (method === "GET" && url.includes("/contents/")) return json({ content: b64(file("recruiting_pipeline.csv")), sha: "p1" });
    if (url.endsWith("/git/ref/heads/main")) return json({ object: { sha: "base" } });
    if (url.endsWith("/pulls")) return json({ html_url: "https://github.com/o/r/pull/9" });
    return json({});
  }) as typeof fetch;
  return calls;
}

const cfg = repoConfig({ GITHUB_TOKEN: "t", GITHUB_REPO: "o/r", DATASET: "sample" })!;

test("repoConfig needs a token", () => {
  assert.equal(repoConfig({}), null);
  assert.deepEqual(cfg, { token: "t", repo: "o/r", base: "main", dataset: "sample" });
});

test("opens a PR that appends exactly one Confirmed row", async () => {
  const calls = fakeGitHub();
  const res = await openCandidatePullRequest(cfg, state("Nova Hill"), { id: "U1", name: "tina" }, "2026-10-05");
  assert.deepEqual(res.ok && res.url, "https://github.com/o/r/pull/9");

  const put = calls.find((c) => c.method === "PUT")!;
  assert.equal(put.body!.sha, "p1");
  const before = file("recruiting_pipeline.csv");
  const after = Buffer.from(put.body!.content, "base64").toString("utf8");
  assert.ok(after.startsWith(before));
  const added = parseCsv(after).at(-1)!;
  assert.equal(parseCsv(after).length, parseCsv(before).length + 1);
  assert.equal(added.candidate_id, "S205");
  assert.equal(added.req_mapping, "Confirmed");
  assert.equal(added.req_id, reqId);

  const ref = calls.find((c) => c.url.endsWith("/git/refs"))!;
  assert.equal(ref.body!.sha, "base");
  assert.equal(put.body!.branch, ref.body!.ref.replace("refs/heads/", ""));
  assert.equal(calls.find((c) => c.url.endsWith("/pulls"))!.body!.base, "main");
});

test("returns errors and writes nothing when the latest data rejects the row", async () => {
  const calls = fakeGitHub();
  const existing = parseCsv(file("recruiting_pipeline.csv")).find((p) => p.req_id === reqId);
  const res = await openCandidatePullRequest(cfg, state(existing?.candidate_name ?? ""), { id: "U1", name: "tina" }, "2026-10-05");
  assert.equal(res.ok, false);
  assert.ok(calls.every((c) => c.method === "GET"));
});
