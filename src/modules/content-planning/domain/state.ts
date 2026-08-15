export type ContentState =
  | "idea"
  | "brief"
  | "in_production"
  | "internal_review"
  | "client_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "archived";

const transitions: Record<ContentState, ContentState[]> = {
  idea: ["brief", "archived"],
  brief: ["in_production", "archived"],
  in_production: ["internal_review", "changes_requested", "archived"],
  internal_review: ["in_production", "client_review", "approved"],
  client_review: ["changes_requested", "approved"],
  changes_requested: ["in_production", "archived"],
  approved: ["scheduled", "client_review"],
  scheduled: ["published", "approved"],
  published: ["archived"],
  archived: [],
};

export function assertContentTransition(from: ContentState, to: ContentState) {
  if (!transitions[from].includes(to)) throw new Error("CONTENT_TRANSITION_INVALID");
}

export function assertPlannedDate(value: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !timezone.includes("/"))
    throw new Error("CONTENT_DATE_INVALID");
}
