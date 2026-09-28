// Opens a PR that appends one candidate to data/<DATASET>/recruiting_pipeline.csv.
// Validation reruns against the base branch so the PR reflects the latest data.

import { parseCsv, toCsvRow } from "@/lib/parsers/csv";
import { prepareCandidate, type ViewState } from "./addCandidate";

export interface RepoConfig {
  token: string;
  repo: string;
  base: string;
  dataset: string;
}

export function repoConfig(env: Record<string, string | undefined> = process.env): RepoConfig | null {
  if (!env.GITHUB_TOKEN) return null;
  return {
    token: env.GITHUB_TOKEN,
    repo: env.GITHUB_REPO ?? "tina-tewari/people-ops-control-tower",
    base: env.GITHUB_BASE_BRANCH ?? "main",
    dataset: env.DATASET ?? "real",
  };
}

async function gh<T>(cfg: RepoConfig, method: string, path: string, body?: object): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function readFile(cfg: RepoConfig, file: string) {
  const f = await gh<{ content: string; sha: string }>(cfg, "GET", `/contents/${file}?ref=${encodeURIComponent(cfg.base)}`);
  return { text: Buffer.from(f.content, "base64").toString("utf8"), sha: f.sha };
}

export interface Submitter {
  id: string;
  name: string;
}

export type CandidatePullRequest =
  | { ok: true; url: string; row: Record<string, string> }
  | { ok: false; errors: string[] };

export async function openCandidatePullRequest(
  cfg: RepoConfig,
  state: ViewState,
  by: Submitter,
  today: string,
): Promise<CandidatePullRequest> {
  const dir = `data/${cfg.dataset}`;
  const pipelinePath = `${dir}/recruiting_pipeline.csv`;
  const [hc, pl] = await Promise.all([readFile(cfg, `${dir}/headcount_plan.csv`), readFile(cfg, pipelinePath)]);
  const { row, errors } = prepareCandidate(state, parseCsv(hc.text), parseCsv(pl.text), today);
  const problems = Object.entries(errors).map(([field, msg]) => `${field}: ${msg}`);
  if (problems.length) return { ok: false, errors: problems };

  const header = pl.text.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "").split(",");
  const updated = pl.text.replace(/\n?$/, "\n") + toCsvRow(header, row) + "\n";
  const branch = `slack/add-candidate-${row.candidate_id.toLowerCase()}-${Date.now()}`;
  const title = `Add candidate ${row.candidate_id} (${row.candidate_name}) to ${row.req_id}`;

  const base = await gh<{ object: { sha: string } }>(cfg, "GET", `/git/ref/heads/${encodeURIComponent(cfg.base)}`);
  await gh(cfg, "POST", "/git/refs", { ref: `refs/heads/${branch}`, sha: base.object.sha });
  await gh(cfg, "PUT", `/contents/${pipelinePath}`, {
    message: title,
    content: Buffer.from(updated, "utf8").toString("base64"),
    sha: pl.sha,
    branch,
  });
  const pr = await gh<{ html_url: string }>(cfg, "POST", "/pulls", {
    title,
    head: branch,
    base: cfg.base,
    body: [
      `Submitted from Slack \`/add-candidate\` by ${by.name} (${by.id}). Appends one row to \`${pipelinePath}\`.`,
      "",
      "| Column | Value |",
      "|---|---|",
      ...header.filter((k) => row[k]).map((k) => `| \`${k}\` | ${row[k].replace(/\|/g, "\\|")} |`),
    ].join("\n"),
  });
  return { ok: true, url: pr.html_url, row };
}
