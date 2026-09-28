// Thin wrappers over the two Slack Web API calls the intake needs.

export async function openView(token: string, triggerId: string, view: object): Promise<void> {
  const res = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ trigger_id: triggerId, view }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!json.ok) throw new Error(`Slack views.open failed: ${json.error ?? res.status}`);
}

/** Ephemeral reply to the user who ran the slash command. */
export async function replyEphemeral(responseUrl: string, text: string): Promise<void> {
  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }),
  });
  if (!res.ok) throw new Error(`Slack response_url failed: ${res.status}`);
}
