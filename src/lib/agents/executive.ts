import { db } from "@/lib/db";
import type { Agent, AgentProposal } from "./types";
import { scoreProposal, DEFAULT_BUDGET } from "./types";

/**
 * EXECUTIVE AGENT — answers "what matters most right now?". It doesn't do the
 * hands-on work; it surfaces the things where the OWNER is the blocker (pending
 * approvals) and frames goal-level opportunities, so the coordinator's ranking
 * reflects business priority, not just per-domain urgency.
 */
export const executiveAgent: Agent = {
  id: "executive",
  role: "Sets priorities and surfaces what needs you",
  budget: DEFAULT_BUDGET,

  async produce(twin, ctx) {
    const out: AgentProposal[] = [];

    // Pending approvals: DONE has already done the work; the owner is the gate.
    const approvals = await db.approval.findMany({
      where: { workspaceId: ctx.workspace.id, status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    for (const a of approvals) {
      const highRisk = a.risk === "high";
      const base = {
        agent: "executive" as const,
        kind: "needs_attention" as const,
        title: `Approve: ${a.title}`,
        summary:
          a.previewText?.slice(0, 200) ||
          a.description?.slice(0, 200) ||
          "An action is prepared and waiting for your decision.",
        reason:
          a.reason ||
          "DONE prepared this action but its category requires your approval before it runs.",
        recommendedAction: "Review and approve, edit, or skip.",
        priority: (highRisk ? "high" : "medium") as "high" | "medium",
        impact: "high" as const,
        risk: (highRisk ? "high" : a.risk === "low" ? "low" : "medium") as "high" | "medium" | "low",
        requiresApproval: true,
        subject: { type: "approval", id: a.id, label: a.title },
        toolsRequired: [a.actionType],
        missionable: false,
      };
      out.push({ ...base, score: scoreProposal(base, 20) });
    }

    return out;
  },
};
