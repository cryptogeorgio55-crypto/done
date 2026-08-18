import type { Agent, AgentProposal } from "./types";
import { scoreProposal, DEFAULT_BUDGET } from "./types";

/**
 * CALENDAR AGENT — watches upcoming meetings and prepares briefs. Preparation
 * is internal work (no external action), so it never needs approval.
 */
export const calendarAgent: Agent = {
  id: "calendar",
  role: "Prepares meetings and watches the schedule",
  budget: DEFAULT_BUDGET,

  async produce(twin) {
    const out: AgentProposal[] = [];
    const next = twin.state.calendar.nextMeeting;
    if (!next) return out;

    const hrsUntil = (new Date(next.at).getTime() - Date.now()) / 3600_000;
    if (hrsUntil > 30 || hrsUntil < 0) return out;

    const base = {
      agent: "calendar" as const,
      kind: "meeting_brief" as const,
      title: `Prepare for "${next.title}"`,
      summary: `Your next meeting is ${hrsUntil < 1 ? "under an hour away" : `in ~${Math.round(hrsUntil)}h`}. A brief pulls together history, open concerns and an objective.`,
      reason:
        "Walking in with the customer's history and open questions in hand makes the conversation far more effective.",
      recommendedAction: "Generate a meeting brief from the customer's history and recent messages.",
      priority: (hrsUntil <= 24 ? "high" : "medium") as "high" | "medium",
      impact: "medium" as const,
      risk: "low" as const,
      requiresApproval: false,
      subject: next.entityId ? { type: "event", id: next.entityId, label: next.title } : null,
      toolsRequired: ["prepare_brief"],
      missionable: true,
    };
    out.push({ ...base, score: scoreProposal(base, Math.max(0, 24 - hrsUntil)) });
    return out;
  },
};
