import { z } from "zod";
import type { BusinessTwin } from "@/lib/digital-twin/twin";
import type { WorkspaceContext } from "@/lib/workspace/context";

/**
 * MULTI-AGENT SYSTEM — contracts.
 *
 * An Agent is a specialized worker with a single responsibility, a budget, and
 * a schema-validated output. Agents do NOT talk to each other in free-form
 * conversation (no runaway recursion). They each read the shared Digital Twin
 * and emit structured Proposals; the Coordinator collects, dedupes and ranks
 * them. Whether a proposal is ever executed is decided later by the policy
 * engine — an agent only ever *proposes*.
 */

export const AGENT_IDS = [
  "executive",
  "sales",
  "customer",
  "calendar",
  "marketing",
  "operations",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

/** A grounded recommendation from an agent. Maps cleanly onto a NextMove/Mission. */
export const AgentProposalSchema = z.object({
  agent: z.enum(AGENT_IDS),
  kind: z.enum([
    "sales_followup",
    "lead_reactivation",
    "meeting_brief",
    "needs_attention",
    "content_gap",
    "commitment",
    "operations",
    "opportunity",
  ]),
  title: z.string(),
  summary: z.string(),
  reason: z.string(),
  recommendedAction: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  impact: z.enum(["high", "medium", "low"]),
  risk: z.enum(["low", "medium", "high"]),
  requiresApproval: z.boolean(),
  /** Deterministic base score so ranking works with zero AI budget. */
  score: z.number(),
  subject: z.object({ type: z.string(), id: z.string(), label: z.string() }).nullable(),
  toolsRequired: z.array(z.string()),
  /** Whether this proposal is substantial enough to become a durable Mission. */
  missionable: z.boolean(),
});

export type AgentProposal = z.infer<typeof AgentProposalSchema>;

/** Hard limits so no agent can run away. Enforced by the coordinator. */
export interface AgentBudget {
  maxProposals: number;
  maxToolCalls: number;
  maxRuntimeMs: number;
}

export const DEFAULT_BUDGET: AgentBudget = {
  maxProposals: 5,
  maxToolCalls: 0, // proposal-only pass: agents read the twin, they don't act
  maxRuntimeMs: 4000,
};

export interface Agent {
  id: AgentId;
  /** One-line responsibility, shown in Mission Control. */
  role: string;
  budget: AgentBudget;
  /**
   * Produce grounded proposals from the twin. Must be deterministic-safe: given
   * the same twin it returns sensible proposals with no AI call. Agents MAY use
   * the AI service to refine phrasing, but the decision of WHAT to propose is
   * grounded in the twin's real rows.
   */
  produce(twin: BusinessTwin, ctx: WorkspaceContext): Promise<AgentProposal[]>;
}

const PRIORITY_WEIGHT = { high: 100, medium: 60, low: 30 } as const;
const IMPACT_WEIGHT = { high: 30, medium: 15, low: 5 } as const;
const RISK_PENALTY = { low: 0, medium: 6, high: 18 } as const;

/** Shared deterministic scorer so every agent ranks on the same scale. */
export function scoreProposal(
  p: Pick<AgentProposal, "priority" | "impact" | "risk">,
  freshness = 0
): number {
  return PRIORITY_WEIGHT[p.priority] + IMPACT_WEIGHT[p.impact] + freshness - RISK_PENALTY[p.risk];
}
