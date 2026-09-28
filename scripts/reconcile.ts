// CLI for the weekly reconciliation job.
//   npm run reconcile                 # run, persist state, print JSON report
//   npm run reconcile -- --digest     # run, persist state, print Slack digest
//   npm run reconcile -- --dry-run    # don't persist state
//   npm run reconcile -- --post       # also post digest to SLACK_WEBHOOK_URL

import { postSlackDigest, slackDigest } from "@/lib/reconciliation/digest";
import { runReconciliation } from "@/lib/reconciliation/job";

async function main() {
  const args = new Set(process.argv.slice(2));
  const run = runReconciliation({ persist: !args.has("--dry-run") });
  const digest = slackDigest(run);
  if (args.has("--post") && !(await postSlackDigest(digest))) {
    throw new Error("--post requires SLACK_WEBHOOK_URL");
  }
  process.stdout.write((args.has("--digest") ? digest : JSON.stringify(run, null, 2)) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
