import type { Agent, AgentProposal } from "./types";
import { scoreProposal, DEFAULT_BUDGET } from "./types";

/**
 * MARKETING AGENT — keeps the business visible, but only when it connects to
 * real business state (a content gap, a goal). It does NOT generate posts just
 * because it can.
 */
export const marketingAgent: Agent = {
  id: "marketing",
  role: "Keeps the business visible when it matters",
  budget: DEFAULT_BUDGET,

  async produce(twin) {
    const out: AgentProposal[] = [];
    const gap = twin.state.marketing.contentGapDays;
    if (gap < 4) return out;

    // If there's an awareness/engagement goal, a gap is more pressing.
    const hasVisibilityGoal = twin.goals.some((g) =>
      ["awareness", "engagement", "leads"].includes(g.key)
    );

    const base = {
      agent: "marketing" as const,
      kind: "content_gap" as const,
      title: "You haven't posted this week",
      summary: `It's been ${gap >= 99 ? "a while" : `${gap} days`} since your last piece of content.`,
      reason: hasVisibilityGoal
        ? "You set a visibility goal — staying consistent is how that goal actually gets met."
        : "Staying visible keeps inbound flowing; a consistent cadence compounds over time.",
      recommendedAction: "Draft this week's post based on what's happening in the business.",
      priority: (hasVisibilityGoal ? "medium" : "low") as "medium" | "low",
      impact: "low" as const,
      risk: "low" as const,
      requiresApproval: false,
      subject: null,
      toolsRequired: ["create_content"],
      missionable: false,
    };
    out.push({ ...base, score: scoreProposal(base, hasVisibilityGoal ? 8 : 0) });
    return out;
  },
};
