import type { Agent, AgentProposal } from "./types";
import { scoreProposal, DEFAULT_BUDGET } from "./types";

/**
 * OPERATIONS AGENT — tracks commitments and forgotten work. Its signature move
 * is surfacing promises WE made that are now due/overdue (see Commitment
 * tracker) so nothing quietly slips.
 */
export const operationsAgent: Agent = {
  id: "operations",
  role: "Tracks promises and overdue work",
  budget: DEFAULT_BUDGET,

  async produce(twin) {
    const out: AgentProposal[] = [];

    // Overdue promises we owe — highest operational priority.
    for (const c of twin.commitments.ourOpen.filter((c) => c.overdue).slice(0, 3)) {
      const base = {
        agent: "operations" as const,
        kind: "commitment" as const,
        title: `You promised: ${c.text}`,
        summary: `A commitment to ${c.party} is past due${c.dueAt ? ` (was due ${new Date(c.dueAt).toLocaleDateString()})` : ""}.`,
        reason:
          "A broken promise costs trust fast. Closing the loop — even to reset expectations — protects the relationship.",
        recommendedAction: `Fulfil or reschedule your commitment to ${c.party}.`,
        priority: "high" as const,
        impact: "high" as const,
        risk: "low" as const,
        requiresApproval: true,
        subject: c.id ? { type: "commitment", id: c.id, label: c.party } : null,
        toolsRequired: ["draft_reply"],
        missionable: false,
      };
      out.push({ ...base, score: scoreProposal(base, 22) });
    }

    // Open (not yet overdue) promises we owe — surface as medium so they don't slip.
    for (const c of twin.commitments.ourOpen.filter((c) => !c.overdue).slice(0, 2)) {
      const base = {
        agent: "operations" as const,
        kind: "commitment" as const,
        title: `Open promise to ${c.party}`,
        summary: c.text,
        reason: "Tracking what you said you'd do keeps commitments from being forgotten.",
        recommendedAction: `Prepare what you owe ${c.party} before it's due.`,
        priority: "medium" as const,
        impact: "medium" as const,
        risk: "low" as const,
        requiresApproval: true,
        subject: c.id ? { type: "commitment", id: c.id, label: c.party } : null,
        toolsRequired: ["draft_reply"],
        missionable: false,
      };
      out.push({ ...base, score: scoreProposal(base, 6) });
    }

    return out;
  },
};
