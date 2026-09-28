// Who owns what, and how often the reconciliation runs. Edit this file to
// change routing — no logic changes needed.

export type OwnerRole = "People Ops" | "Recruiting Ops" | "HRIS" | "Hiring manager";

export const ROUTING = {
  /** Scheduled run (also mirrored in vercel.json). Daily 13:00 UTC ≈ 8am Central. */
  schedule: { cron: "0 13 * * *", label: "Daily at 13:00 UTC" },

  /** Where each owning team receives its queue. */
  channels: {
    "People Ops": "#people-ops-review",
    "Recruiting Ops": "#recruiting-ops",
    HRIS: "#hris-data-quality",
    "Hiring manager": "Direct message",
  } satisfies Record<OwnerRole, string>,

  /** Stalled candidates in these stages are waiting on the hiring manager. */
  hiringManagerStages: ["Hiring Manager Interview", "Final Round"],

  /** Everything else in the active funnel is owned by recruiting. */
  recruiterStages: ["Applied", "Phone Screen", "Technical/Assessment", "Offer Extended"],

  /** Optional per-department recruiting owner; falls back to "Recruiting Ops". */
  recruiterByDepartment: {} as Record<string, string>,
};

export function channelFor(role: OwnerRole): string {
  return ROUTING.channels[role];
}
