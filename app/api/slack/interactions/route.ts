// Slack interactivity endpoint: handles the add-candidate modal submission.
// Field errors are returned inline within Slack's 3s window; the PR is opened
// after the response and its link is sent back to the submitter.

import { after } from "next/server";
import { readSourceCsv } from "@/lib/data/load";
import { ADD_CANDIDATE_CALLBACK, prepareCandidate, type ModalMetadata, type ViewState } from "@/lib/slack/addCandidate";
import { replyEphemeral } from "@/lib/slack/api";
import { openCandidatePullRequest, repoConfig } from "@/lib/slack/github";
import { readSlackForm } from "@/lib/slack/verify";

export const maxDuration = 60;

interface ViewSubmission {
  type: string;
  user: { id: string; name?: string; username?: string };
  view: { callback_id: string; private_metadata?: string; state: { values: ViewState } };
}

function metadata(raw: string | undefined): ModalMetadata {
  try {
    return JSON.parse(raw ?? "") as ModalMetadata;
  } catch {
    return { responseUrl: null };
  }
}

export async function POST(request: Request) {
  const form = await readSlackForm(request);
  if (form instanceof Response) return form;
  const payload = JSON.parse(form.get("payload") ?? "null") as ViewSubmission | null;
  if (payload?.type !== "view_submission" || payload.view.callback_id !== ADD_CANDIDATE_CALLBACK) {
    return new Response(null, { status: 200 });
  }

  const state = payload.view.state.values;
  const today = new Date().toISOString().slice(0, 10);
  const { errors } = prepareCandidate(state, readSourceCsv("headcount_plan.csv"), readSourceCsv("recruiting_pipeline.csv"), today);
  const cfg = repoConfig();
  if (!cfg) errors.candidate_name ??= "GITHUB_TOKEN isn't set, so no PR can be opened. Ask an admin.";
  if (!cfg || Object.keys(errors).length) return Response.json({ response_action: "errors", errors });

  const { responseUrl } = metadata(payload.view.private_metadata);
  const by = { id: payload.user.id, name: payload.user.name ?? payload.user.username ?? payload.user.id };
  after(async () => {
    let text: string;
    try {
      const pr = await openCandidatePullRequest(cfg, state, by, today);
      text = pr.ok
        ? `Added *${pr.row.candidate_name}* (${pr.row.candidate_id}) to ${pr.row.req_id}. Review and merge: ${pr.url}`
        : `Couldn't add the candidate; the latest data rejected it:\n• ${pr.errors.join("\n• ")}`;
    } catch (e) {
      console.error(e);
      text = `Couldn't open the PR: ${(e as Error).message}`;
    }
    if (responseUrl) await replyEphemeral(responseUrl, text);
  });
  return new Response(null, { status: 200 });
}
