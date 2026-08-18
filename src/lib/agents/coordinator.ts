import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { buildTwin, type BusinessTwin } from "@/lib/digital-twin/twin";
import { AGENTS } from "./registry";
import { AgentProposalSchema, type Agent, type AgentId, type AgentProposal } from "./types";

/**
 * COORDINATOR — runs the agent roster against one shared Digital Twin, within
 * per-agent budgets, then collects, validates, dedupes and ranks their
 * proposals. This is the single entry point the product uses to ask "what does
 * the whole team think we should do?" — Next Move, Mission Control and the
 * Chief of Staff all read from here.
 *
 * Agents run independently (no cross-chatter, no recursion). One agent throwing
 * or timing out never sinks the others.
 */

export interface AgentStatus {
  id: AgentId;
  role: string;
  proposals: number;
  ms: number;
  state: "working" | "idle" | "error";
}

export interface CoordinatorResult {
  twin: BusinessTwin;
  proposals: AgentProposal[]; // deduped + ranked (highest score first)
  agents: AgentStatus[];
}

/** Run a single agent under its runtime budget. Never throws. */
async function runAgent(
  agent: Agent,
  twin: BusinessTwin,
  ctx: WorkspaceContext
): Promise<{ status: AgentStatus; proposals: AgentProposal[] }> {
  const started = Date.now();
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("agent_timeout")), agent.budget.maxRuntimeMs)
    );
    const raw = await Promise.race([agent.produce(twin, ctx), timeout]);
    // Validate + clamp to the budget so a misbehaving agent can't flood ranking.
    const valid = raw
      .map((p) => AgentProposalSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => (r as { data: AgentProposal }).data)
      .slice(0, agent.budget.maxProposals);
    const ms = Date.now() - started;
    return {
      status: { id: agent.id, role: agent.role, proposals: valid.length, ms, state: valid.length ? "working" : "idle" },
      proposals: valid,
    };
  } catch {
    return {
      status: { id: agent.id, role: agent.role, proposals: 0, ms: Date.now() - started, state: "error" },
      proposals: [],
    };
  }
}

/**
 * De-duplicate proposals that target the same subject/kind, keeping the highest
 * score. Prevents two agents both surfacing "follow up Sarah".
 */
function dedupe(proposals: AgentProposal[]): AgentProposal[] {
  const best = new Map<string, AgentProposal>();
  for (const p of proposals) {
    const key = `${p.kind}:${p.subject?.id ?? p.title}`;
    const existing = best.get(key);
    if (!existing || p.score > existing.score) best.set(key, p);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

/** Run the whole roster and return ranked proposals + per-agent status. */
export async function runCoordinator(ctx: WorkspaceContext): Promise<CoordinatorResult> {
  const twin = await buildTwin(ctx);
  const results = await Promise.all(AGENTS.map((a) => runAgent(a, twin, ctx)));

  const proposals = dedupe(results.flatMap((r) => r.proposals));
  const agents = results.map((r) => r.status);

  // Best-effort observability. Never let logging failures break the response.
  try {
    await db.agentRun.createMany({
      data: agents.map((s) => ({
        workspaceId: ctx.workspace.id,
        agent: s.id,
        trigger: "coordinator",
        status: s.state === "error" ? "failed" : "completed",
        proposals: s.proposals,
        ms: s.ms,
        usedAi: false,
        summary: `${s.proposals} proposal(s)`,
      })),
    });
  } catch {
    /* observability is best-effort */
  }

  return { twin, proposals, agents };
}
