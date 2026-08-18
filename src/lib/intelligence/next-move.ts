import { z } from "zod";
import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { computeBusinessState, type BusinessState } from "./business-state";

/**
 * NEXT MOVE ENGINE
 *
 * Continuously answers "what should happen next?" by deriving ranked, grounded
 * recommendations from real business state — leads, follow-ups, approvals,
 * calendar, needs-attention signals and marketing cadence. Nothing here is
 * hard-coded: every move is produced from actual records, with the entity it
 * refers to and the tools its execution would require. Ranking surfaces the
 * top 1–3 moves that matter most right now.
 *
 * This engine is deterministic and works with zero AI budget (it powers the
 * offline/test path). The reasoning model can *refine* phrasing on top, but the
 * decision of what matters is grounded in data, not a hallucination.
 */

export const NextMoveSchema = z.object({
  id: z.string(),
  type: z.enum([
    "sales_followup",
    "lead_reactivation",
    "meeting_brief",
    "approval",
    "needs_attention",
    "content_gap",
    "commitment",
    "operations",
    "opportunity",
  ]),
  priority: z.enum(["high", "medium", "low"]),
  title: z.string(),
  summary: z.string(),
  reason: z.string(),
  recommendedAction: z.string(),
  expectedImpact: z.enum(["high", "medium", "low"]),
  risk: z.enum(["low", "medium", "high"]),
  requiresApproval: z.boolean(),
  entities: z.array(
    z.object({ type: z.string(), id: z.string(), label: z.string() })
  ),
  toolsRequired: z.array(z.string()),
  /** Internal ranking score — higher = more valuable now. Not shown raw to users. */
  score: z.number(),
});

export type NextMove = z.infer<typeof NextMoveSchema>;

const PRIORITY_WEIGHT: Record<NextMove["priority"], number> = { high: 100, medium: 60, low: 30 };
const IMPACT_WEIGHT: Record<NextMove["expectedImpact"], number> = { high: 30, medium: 15, low: 5 };
const RISK_PENALTY: Record<NextMove["risk"], number> = { low: 0, medium: 6, high: 18 };
const DAY = 24 * 3600_000;

function hoursSince(d: Date | null | undefined): number {
  if (!d) return Infinity;
  return (Date.now() - d.getTime()) / 3600_000;
}

/** Final score = priority + impact + freshness − risk penalty. Deterministic. */
function score(m: Omit<NextMove, "score">, freshness = 0): number {
  return PRIORITY_WEIGHT[m.priority] + IMPACT_WEIGHT[m.expectedImpact] + freshness - RISK_PENALTY[m.risk];
}

export interface NextMoveResult {
  state: BusinessState;
  moves: NextMove[]; // top N, ranked
  all: NextMove[]; // every candidate, ranked
}

/**
 * Build ranked Next Moves for a workspace. `limit` controls how many top moves
 * are returned in `moves` (default 3 — we never surface 25 equal items).
 */
export async function buildNextMoves(
  ctx: WorkspaceContext,
  opts: { limit?: number } = {}
): Promise<NextMoveResult> {
  const wsId = ctx.workspace.id;
  const limit = opts.limit ?? 3;
  const state = await computeBusinessState(ctx);
  const candidates: NextMove[] = [];

  // ---- Pending approvals: the owner is the blocker → surface first. ----
  const approvals = await db.approval.findMany({
    where: { workspaceId: wsId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  for (const a of approvals) {
    const base = {
      id: `approval:${a.id}`,
      type: "approval" as const,
      priority: (a.risk === "high" ? "high" : "medium") as NextMove["priority"],
      title: `Approve: ${a.title}`,
      summary: a.previewText?.slice(0, 200) || a.description?.slice(0, 200) || "An action is waiting for your decision.",
      reason: a.reason || "DONE prepared this action but its category requires your approval before it runs.",
      recommendedAction: "Review and approve, edit, or skip.",
      expectedImpact: "high" as const,
      risk: (a.risk === "high" ? "high" : a.risk === "low" ? "low" : "medium") as NextMove["risk"],
      requiresApproval: true,
      entities: [{ type: "approval", id: a.id, label: a.title }],
      toolsRequired: [a.actionType],
    };
    candidates.push({ ...base, score: score(base, 20) });
  }

  // ---- Hot leads: engaged + recent inbound → likely to move with a reply. ----
  const hotLeads = await db.lead.findMany({
    where: {
      workspaceId: wsId, deletedAt: null,
      stage: { in: ["contacted", "interested", "followup"] },
      lastContactAt: { gte: new Date(Date.now() - 3 * DAY) },
    },
    orderBy: { lastContactAt: "desc" },
    take: 5,
  });
  for (const lead of hotLeads) {
    const hrs = hoursSince(lead.lastContactAt);
    const base = {
      id: `lead_hot:${lead.id}`,
      type: "sales_followup" as const,
      priority: "high" as NextMove["priority"],
      title: `Follow up ${lead.name} now`,
      summary: `${lead.name} is engaged (${lead.stage}) and was last in touch ${hrs < 24 ? `${Math.max(1, Math.round(hrs))}h` : `${Math.round(hrs / 24)}d`} ago.`,
      reason: "An engaged lead who replied recently is a stronger buying signal than a cold inquiry — responding while intent is high moves the deal forward.",
      recommendedAction: `Reply to ${lead.name} and propose a concrete next step (call, kickoff date, or proposal).`,
      expectedImpact: "high" as const,
      risk: "low" as const,
      requiresApproval: true, // external message → policy decides at execution
      entities: [{ type: "lead", id: lead.id, label: lead.name }],
      toolsRequired: ["draft_reply", "send_message"],
    };
    // Fresher contact ⇒ higher freshness score (up to ~30).
    candidates.push({ ...base, score: score(base, Math.max(0, 30 - hrs)) });
  }

  // ---- Follow-ups whose time has arrived. ----
  const dueFollowups = await db.lead.findMany({
    where: {
      workspaceId: wsId, deletedAt: null,
      stage: { notIn: ["won", "lost"] },
      nextFollowUpAt: { lte: new Date() },
    },
    orderBy: { nextFollowUpAt: "asc" },
    take: 5,
  });
  for (const lead of dueFollowups) {
    if (candidates.some((c) => c.entities[0]?.id === lead.id)) continue; // don't double-surface
    const base = {
      id: `followup_due:${lead.id}`,
      type: "sales_followup" as const,
      priority: "medium" as NextMove["priority"],
      title: `Follow-up due for ${lead.name}`,
      summary: `A follow-up you scheduled for ${lead.name} is now due.`,
      reason: "Following up on time is the difference between a warm lead and a lost one.",
      recommendedAction: `Send ${lead.name} the follow-up you planned.`,
      expectedImpact: "medium" as const,
      risk: "low" as const,
      requiresApproval: true,
      entities: [{ type: "lead", id: lead.id, label: lead.name }],
      toolsRequired: ["draft_reply", "send_message"],
    };
    candidates.push({ ...base, score: score(base, 12) });
  }

  // ---- Dormant leads worth reactivating (aggregate into one move). ----
  const staleLeads = await db.lead.findMany({
    where: {
      workspaceId: wsId, deletedAt: null,
      stage: { in: ["contacted", "interested", "followup"] },
      lastContactAt: { lte: new Date(Date.now() - 14 * DAY) },
    },
    orderBy: { lastContactAt: "asc" },
    take: 25,
  });
  if (staleLeads.length >= 2) {
    const base = {
      id: "reactivation:batch",
      type: "lead_reactivation" as const,
      priority: "medium" as NextMove["priority"],
      title: `${staleLeads.length} old leads are worth reactivating`,
      summary: `These leads previously showed interest but haven't been contacted in 14+ days.`,
      reason: "Warm leads that went quiet are far cheaper to re-engage than acquiring new ones — a personal, specific nudge often revives them.",
      recommendedAction: "Prepare personalized reactivation messages for review.",
      expectedImpact: "medium" as const,
      risk: "low" as const,
      requiresApproval: true, // bulk communication
      entities: staleLeads.slice(0, 8).map((l) => ({ type: "lead", id: l.id, label: l.name })),
      toolsRequired: ["create_campaign", "draft_reply"],
    };
    candidates.push({ ...base, score: score(base, Math.min(20, staleLeads.length * 2)) });
  }

  // ---- Upcoming meeting needs a brief. ----
  if (state.calendar.nextMeeting) {
    const at = new Date(state.calendar.nextMeeting.at);
    const hrsUntil = (at.getTime() - Date.now()) / 3600_000;
    if (hrsUntil <= 30) {
      const base = {
        id: `meeting_brief:${state.calendar.nextMeeting.entityId ?? "next"}`,
        type: "meeting_brief" as const,
        priority: (hrsUntil <= 24 ? "high" : "medium") as NextMove["priority"],
        title: `Prepare for "${state.calendar.nextMeeting.title}"`,
        summary: `Your next meeting is ${hrsUntil < 1 ? "under an hour" : `in ~${Math.round(hrsUntil)}h`}. A brief pulls together history, open concerns and an objective.`,
        reason: "Walking into a meeting with the customer's history and open questions in hand makes the conversation far more effective.",
        recommendedAction: "Generate a meeting brief from the customer's history and recent messages.",
        expectedImpact: "medium" as const,
        risk: "low" as const,
        requiresApproval: false, // internal preparation, no external action
        entities: state.calendar.nextMeeting.entityId
          ? [{ type: "event", id: state.calendar.nextMeeting.entityId, label: state.calendar.nextMeeting.title }]
          : [],
        toolsRequired: ["prepare_brief"],
      };
      candidates.push({ ...base, score: score(base, Math.max(0, 24 - hrsUntil)) });
    }
  }

  // ---- Unhandled "needs attention" signals. ----
  const attention = await db.event.findMany({
    where: { workspaceId: wsId, category: "needs_attention", status: { in: ["new", "processing"] } },
    orderBy: { occurredAt: "desc" },
    take: 3,
  });
  for (const e of attention) {
    const base = {
      id: `attention:${e.id}`,
      type: "needs_attention" as const,
      priority: (e.urgency === "high" ? "high" : "medium") as NextMove["priority"],
      title: e.title || "Something needs your attention",
      summary: e.summary?.slice(0, 200) || "An incoming signal was flagged as needing attention.",
      reason: "Flagged signals — complaints, urgent questions, escalations — lose value fast if they sit unanswered.",
      recommendedAction: "Review this and decide how DONE should respond.",
      expectedImpact: "medium" as const,
      risk: "medium" as const,
      requiresApproval: true,
      entities: e.entityId ? [{ type: "entity", id: e.entityId, label: e.title || "signal" }] : [],
      toolsRequired: ["review"],
    };
    candidates.push({ ...base, score: score(base, 10) });
  }

  // ---- Marketing content gap. ----
  if (state.marketing.contentGapDays >= 4) {
    const base = {
      id: "content_gap",
      type: "content_gap" as const,
      priority: "low" as NextMove["priority"],
      title: "You haven't posted this week",
      summary: `It's been ${state.marketing.contentGapDays >= 99 ? "a while" : `${state.marketing.contentGapDays} days`} since your last piece of content.`,
      reason: "Staying visible keeps inbound flowing; a consistent cadence compounds over time.",
      recommendedAction: "Draft this week's post based on what's happening in the business.",
      expectedImpact: "low" as const,
      risk: "low" as const,
      requiresApproval: false,
      entities: [],
      toolsRequired: ["create_content"],
    };
    candidates.push({ ...base, score: score(base, 0) });
  }

  const all = candidates.slice().sort((a, b) => b.score - a.score);
  return { state, moves: all.slice(0, limit), all };
}
