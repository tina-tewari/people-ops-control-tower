// Slack slash command `/add-candidate`: opens the add-candidate modal.
// Needs SLACK_SIGNING_SECRET, SLACK_BOT_TOKEN and GITHUB_TOKEN (see README).

import { readSourceCsv } from "@/lib/data/load";
import { addCandidateModal } from "@/lib/slack/addCandidate";
import { openView } from "@/lib/slack/api";
import { repoConfig } from "@/lib/slack/github";
import { readSlackForm } from "@/lib/slack/verify";

const ephemeral = (text: string) => Response.json({ response_type: "ephemeral", text });

export async function POST(request: Request) {
  const form = await readSlackForm(request);
  if (form instanceof Response) return form;
  if (form.get("ssl_check")) return new Response(null, { status: 200 });

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !repoConfig()) {
    return ephemeral("The add-candidate form isn't configured yet: SLACK_BOT_TOKEN and GITHUB_TOKEN must be set.");
  }
  const today = new Date().toISOString().slice(0, 10);
  const view = addCandidateModal(readSourceCsv("headcount_plan.csv"), { responseUrl: form.get("response_url") }, today);
  try {
    await openView(token, form.get("trigger_id") ?? "", view);
  } catch (e) {
    return ephemeral(`Couldn't open the form: ${(e as Error).message}`);
  }
  return new Response(null, { status: 200 });
}
