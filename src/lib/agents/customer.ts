import { db } from "@/lib/db";
import type { Agent, AgentProposal } from "./types";
import { scoreProposal, DEFAULT_BUDGET } from "./types";

/**
 * CUSTOMER AGENT — watches for unhandled customer signals (complaints, urgent
 * questions, escalations) surfaced as "needs_attention" events and turns them
 * into a decision surface. Sensitive by nature, so it always asks first.
 */
export const customerAgent: Agent = {
  id: "customer",
  role: "Handles customer questions and complaints",
  budget: DEFAULT_BUDGET,

  async produce(twin, ctx) {
    const out: AgentProposal[] = [];
    if (twin.state.customers.attentionRequired === 0) return out;

    const signals = await db.event.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        category: "needs_attention",
        status: { in: ["new", "processing"] },
      },
      orderBy: { occurredAt: "desc" },
      take: 3,
    });

    for (const e of signals) {
      const urgent = e.urgency === "high";
      const base = {
        agent: "customer" as const,
        kind: "needs_attention" as const,
        title: e.title || "A customer needs attention",
        summary: e.summary?.slice(0, 200) || "An incoming signal was flagged as needing attention.",
        reason:
          "Flagged signals — complaints, urgent questions, escalations — lose value fast if they sit unanswered.",
        recommendedAction: "Review this and decide how DONE should respond.",
        priority: (urgent ? "high" : "medium") as "high" | "medium",
        impact: "high" as const,
        risk: "medium" as const,
        requiresApproval: true,
        subject: e.entityId ? { type: "entity", id: e.entityId, label: e.title || "signal" } : null,
        toolsRequired: ["review", "draft_reply"],
        missionable: false,
      };
      out.push({ ...base, score: scoreProposal(base, urgent ? 18 : 10) });
    }

    return out;
  },
};
