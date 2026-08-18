import type { WorkspaceContext } from "@/lib/workspace/context";
import { runCoordinator, type AgentStatus } from "@/lib/agents/coordinator";
import type { AgentProposal } from "@/lib/agents/types";
import type { BusinessState } from "./business-state";
import { NextMoveSchema, type NextMove } from "./next-move";

/**
 * NEXT MOVE 2.0
 *
 * The v1 engine derived moves directly from business state. v2 asks the whole
 * agent team (via the coordinator) what they think should happen, then ranks
 * their combined, de-duplicated proposals. The output type is unchanged
 * (NextMove) so the UI and API stay compatible — but now every move is attributed
 * to the agent that raised it, and the same run powers Mission Control.
 */

/** An agent proposal's kind maps onto the NextMove type; "approval" is special. */
function toNextMoveType(p: AgentProposal): NextMove["type"] {
  if (p.subject?.type === "approval") return "approval";
  switch (p.kind) {
    case "sales_followup":
    case "lead_reactivation":
    case "meeting_brief":
    case "needs_attention":
    case "content_gap":
    case "commitment":
    case "operations":
    case "opportunity":
      return p.kind;
    default:
      return "needs_attention";
  }
}

function toNextMove(p: AgentProposal): NextMove {
  const move = {
    id: `${p.agent}:${p.subject?.id ?? p.kind}`,
    type: toNextMoveType(p),
    priority: p.priority,
    title: p.title,
    summary: p.summary,
    reason: p.reason,
    recommendedAction: p.recommendedAction,
    expectedImpact: p.impact,
    risk: p.risk,
    requiresApproval: p.requiresApproval,
    entities: p.subject ? [{ type: p.subject.type, id: p.subject.id, label: p.subject.label }] : [],
    toolsRequired: p.toolsRequired,
    score: p.score,
  };
  // Validate against the shared schema so the API contract is guaranteed.
  return NextMoveSchema.parse(move);
}

export interface NextMoveV2Result {
  state: BusinessState;
  moves: NextMove[];
  all: NextMove[];
  agents: AgentStatus[];
  /** Which agent raised each move, keyed by move id — for attribution in the UI. */
  attribution: Record<string, string>;
}

/** Build ranked Next Moves from the multi-agent coordinator. */
export async function buildNextMovesV2(
  ctx: WorkspaceContext,
  opts: { limit?: number } = {}
): Promise<NextMoveV2Result> {
  const limit = opts.limit ?? 3;
  const { twin, proposals, agents } = await runCoordinator(ctx);

  const attribution: Record<string, string> = {};
  const all = proposals.map((p) => {
    const move = toNextMove(p);
    attribution[move.id] = p.agent;
    return move;
  });

  return { state: twin.state, moves: all.slice(0, limit), all, agents, attribution };
}
