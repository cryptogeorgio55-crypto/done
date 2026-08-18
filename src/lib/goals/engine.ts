import type { WorkspaceContext } from "@/lib/workspace/context";
import { buildTwin, type BusinessTwin } from "@/lib/digital-twin/twin";

/**
 * GOAL ENGINE
 *
 * Turns a business goal (BusinessGoal.key) into a measurable, twin-derived
 * progress read plus the activities that would advance it. Progress is computed
 * from REAL rows in the twin — never invented — and each goal maps to concrete
 * levers the agents already produce (follow-ups, reactivation, content).
 *
 * This is deliberately deterministic: it gives the Chief of Staff and Mission
 * engine a grounded sense of "are we moving toward the goal?" without a model
 * call. Where a goal needs a hard numeric target the owner hasn't set, we say
 * so rather than fabricate a number.
 */

export interface GoalProgress {
  key: string;
  label: string;
  /** Qualitative momentum derived from twin signals. */
  momentum: "ahead" | "on_track" | "at_risk" | "unknown";
  signal: string; // one-line grounded explanation
  levers: string[]; // concrete activities that would move this goal
}

function assess(key: string, twin: BusinessTwin): Omit<GoalProgress, "key" | "label"> {
  const s = twin.state;
  switch (key) {
    case "sales":
    case "leads":
      if (s.sales.hotLeads > 0) {
        return {
          momentum: "on_track",
          signal: `${s.sales.hotLeads} engaged lead(s) in play, ${s.sales.followupsDue} follow-up(s) due.`,
          levers: ["Follow up hot leads", "Reactivate dormant leads"],
        };
      }
      return {
        momentum: twin.people.stale.length > 0 ? "at_risk" : "unknown",
        signal: twin.people.stale.length
          ? `No hot leads right now, but ${twin.people.stale.length} dormant lead(s) could be revived.`
          : "No active pipeline signal yet.",
        levers: ["Reactivate dormant leads", "Publish to generate inbound"],
      };
    case "bookings":
      return {
        momentum: s.calendar.meetingsNext24h > 0 ? "on_track" : "at_risk",
        signal: `${s.calendar.meetingsNext24h} meeting(s) in the next 24h.`,
        levers: ["Follow up leads who asked about availability", "Offer open slots to warm contacts"],
      };
    case "awareness":
    case "engagement":
      return {
        momentum: s.marketing.contentGapDays <= 3 ? "on_track" : "at_risk",
        signal:
          s.marketing.contentGapDays >= 99
            ? "No content published yet."
            : `${s.marketing.contentGapDays} day(s) since last post.`,
        levers: ["Publish this week's content", "Repurpose a recent win"],
      };
    case "repeat":
      return {
        momentum: "unknown",
        signal: "Repeat-purchase tracking needs order history to measure precisely.",
        levers: ["Reactivate past customers", "Offer a returning-customer incentive"],
      };
    default:
      return { momentum: "unknown", signal: "No grounded signal for this goal yet.", levers: [] };
  }
}

/** Compute grounded progress for every goal in the workspace. */
export async function computeGoalProgress(ctx: WorkspaceContext, twin?: BusinessTwin): Promise<GoalProgress[]> {
  const t = twin ?? (await buildTwin(ctx));
  return t.goals.map((g) => ({ key: g.key, label: g.label, ...assess(g.key, t) }));
}
