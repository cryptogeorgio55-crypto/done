import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { AgentProposal } from "@/lib/agents/types";

/**
 * MISSION ENGINE
 *
 * A Mission is a durable, multi-step objective persisted in the database, so
 * autonomous work survives a browser close or a redeploy. This module builds a
 * mission's step plan from an agent proposal and advances it one step at a time.
 *
 * Honesty boundary: internal steps (observe/analyze/prepare/verify) progress
 * deterministically. Steps that take an EXTERNAL action (sending a message,
 * booking) do NOT get silently executed here — they pause the mission at
 * `waiting_approval`, which is where the existing policy engine + executor take
 * over. The engine never claims an external action happened when it didn't.
 */

type StepSeed = {
  title: string;
  kind: "observe" | "analyze" | "prepare" | "approve" | "execute" | "verify" | "followup";
  tool?: string;
  requiresApproval?: boolean;
};

/** Step plan templates per proposal kind. Grounded in what actually must happen. */
function planFor(p: AgentProposal): { kind: string; steps: StepSeed[] } {
  switch (p.kind) {
    case "sales_followup":
      return {
        kind: "sales_close",
        steps: [
          { title: "Read the full conversation", kind: "observe" },
          { title: "Identify the open question or objection", kind: "analyze" },
          { title: "Check pricing & availability", kind: "analyze" },
          { title: "Prepare the reply", kind: "prepare", tool: "draft_reply" },
          { title: "Send the reply", kind: "execute", tool: "send_message", requiresApproval: true },
          { title: "Set a follow-up if no answer", kind: "followup", tool: "create_followup" },
        ],
      };
    case "lead_reactivation":
      return {
        kind: "lead_reactivation",
        steps: [
          { title: "Select eligible dormant leads", kind: "observe" },
          { title: "Segment by interest & history", kind: "analyze" },
          { title: "Prepare personalized messages", kind: "prepare", tool: "draft_reply" },
          { title: "Send after approval", kind: "execute", tool: "send_message", requiresApproval: true },
          { title: "Track replies", kind: "verify" },
        ],
      };
    case "meeting_brief":
      return {
        kind: "meeting_prep",
        steps: [
          { title: "Gather customer history", kind: "observe" },
          { title: "Pull open concerns & objective", kind: "analyze" },
          { title: "Prepare the brief", kind: "prepare", tool: "prepare_brief" },
        ],
      };
    case "commitment":
      return {
        kind: "custom",
        steps: [
          { title: "Recall what was promised", kind: "observe" },
          { title: "Prepare what you owe", kind: "prepare", tool: "draft_reply" },
          { title: "Send/deliver after approval", kind: "execute", tool: "send_message", requiresApproval: true },
        ],
      };
    default:
      return {
        kind: "custom",
        steps: [
          { title: "Gather context", kind: "observe" },
          { title: "Prepare the action", kind: "prepare" },
          { title: "Complete after approval", kind: "execute", requiresApproval: true },
        ],
      };
  }
}

export interface MissionWithSteps {
  id: string;
  title: string;
  objective: string;
  kind: string;
  status: string;
  steps: {
    id: string;
    seq: number;
    title: string;
    kind: string;
    status: string;
    requiresApproval: boolean;
  }[];
}

/** Create a durable Mission (+steps) from an agent proposal. Idempotent-ish:
 *  callers should avoid creating duplicates for the same subject/kind. */
export async function createMissionFromProposal(
  ctx: WorkspaceContext,
  p: AgentProposal,
  opts: { autonomy?: string; origin?: string; goalKey?: string } = {}
): Promise<MissionWithSteps> {
  const plan = planFor(p);
  const priority = p.priority === "high" ? 100 : p.priority === "medium" ? 60 : 30;

  const mission = await db.mission.create({
    data: {
      workspaceId: ctx.workspace.id,
      kind: plan.kind,
      title: p.title,
      objective: p.recommendedAction,
      status: "active",
      autonomy: opts.autonomy ?? "prepare",
      priority,
      goalKey: opts.goalKey,
      origin: opts.origin ?? "next_move",
      subjectType: p.subject?.type,
      subjectId: p.subject?.id,
      context: { proposal: p },
      steps: {
        create: plan.steps.map((s, i) => ({
          workspaceId: ctx.workspace.id,
          seq: i,
          title: s.title,
          kind: s.kind,
          tool: s.tool,
          requiresApproval: s.requiresApproval ?? false,
          status: "pending",
        })),
      },
    },
    include: { steps: { orderBy: { seq: "asc" } } },
  });

  return toView(mission);
}

/**
 * Advance a mission by executing the next pending internal step. Stops (and
 * flips the mission to `waiting_approval`) when it reaches a step that takes an
 * external action — that boundary belongs to the policy engine, not here.
 * Returns the updated mission. Safe to call repeatedly (durable/resumable).
 */
export async function advanceMission(ctx: WorkspaceContext, missionId: string): Promise<MissionWithSteps | null> {
  const mission = await db.mission.findFirst({
    where: { id: missionId, workspaceId: ctx.workspace.id },
    include: { steps: { orderBy: { seq: "asc" } } },
  });
  if (!mission) return null;
  if (mission.status === "completed" || mission.status === "cancelled") return toView(mission);

  const next = mission.steps.find((s) => s.status === "pending" || s.status === "running");
  if (!next) {
    const done = await db.mission.update({
      where: { id: mission.id },
      data: { status: "completed", completedAt: new Date(), lastActiveAt: new Date() },
      include: { steps: { orderBy: { seq: "asc" } } },
    });
    return toView(done);
  }

  // An external/approval step pauses the mission at the policy boundary.
  if (next.requiresApproval || next.kind === "execute" || next.kind === "approve") {
    await db.missionStep.update({ where: { id: next.id }, data: { status: "waiting_approval" } });
    const updated = await db.mission.update({
      where: { id: mission.id },
      data: { status: "waiting_approval", lastActiveAt: new Date() },
      include: { steps: { orderBy: { seq: "asc" } } },
    });
    return toView(updated);
  }

  // Internal step — mark it done deterministically and keep the mission active.
  await db.missionStep.update({
    where: { id: next.id },
    data: { status: "done", startedAt: new Date(), finishedAt: new Date() },
  });
  const updated = await db.mission.update({
    where: { id: mission.id },
    data: { status: "active", lastActiveAt: new Date() },
    include: { steps: { orderBy: { seq: "asc" } } },
  });
  return toView(updated);
}

function toView(m: {
  id: string; title: string; objective: string; kind: string; status: string;
  steps: { id: string; seq: number; title: string; kind: string; status: string; requiresApproval: boolean }[];
}): MissionWithSteps {
  return {
    id: m.id,
    title: m.title,
    objective: m.objective,
    kind: m.kind,
    status: m.status,
    steps: m.steps.map((s) => ({
      id: s.id, seq: s.seq, title: s.title, kind: s.kind,
      status: s.status, requiresApproval: s.requiresApproval,
    })),
  };
}
