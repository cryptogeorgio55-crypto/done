import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { AgentProposal } from "@/lib/agents/types";
import { executeAction } from "@/lib/tools/executor";
import { getAutonomyConfig } from "@/lib/autonomy/settings";

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
          { title: "Prepare the reply", kind: "prepare" },
          { title: "Send the reply", kind: "execute", tool: "send_email", requiresApproval: true },
          { title: "Set a follow-up if no answer", kind: "followup", tool: "create_followup" },
        ],
      };
    case "lead_reactivation":
      return {
        kind: "lead_reactivation",
        steps: [
          { title: "Select eligible dormant leads", kind: "observe" },
          { title: "Segment by interest & history", kind: "analyze" },
          { title: "Prepare personalized messages", kind: "prepare" },
          { title: "Send after approval", kind: "execute", tool: "send_email", requiresApproval: true },
          { title: "Track replies", kind: "verify" },
        ],
      };
    case "meeting_brief":
      return {
        kind: "meeting_prep",
        steps: [
          { title: "Gather customer history", kind: "observe" },
          { title: "Pull open concerns & objective", kind: "analyze" },
          { title: "Deliver the brief", kind: "prepare", tool: "notify_owner" },
        ],
      };
    case "commitment":
      return {
        kind: "custom",
        steps: [
          { title: "Recall what was promised", kind: "observe" },
          { title: "Prepare what you owe", kind: "prepare" },
          { title: "Send/deliver after approval", kind: "execute", tool: "send_email", requiresApproval: true },
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

type MissionRow = NonNullable<Awaited<ReturnType<typeof loadMission>>>;

function loadMission(ctx: WorkspaceContext, missionId: string) {
  return db.mission.findFirst({
    where: { id: missionId, workspaceId: ctx.workspace.id },
    include: { steps: { orderBy: { seq: "asc" } } },
  });
}

/** Compose a grounded starting draft for a lead. Honest: this is a first draft
 *  the owner reviews/edits in the Approval Center — never sent silently. */
async function composeDraftForLead(ctx: WorkspaceContext, leadId: string, objective: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, workspaceId: ctx.workspace.id } });
  if (!lead?.email) return null;
  const profile = await db.businessProfile.findUnique({ where: { workspaceId: ctx.workspace.id } });
  const config = await getAutonomyConfig(ctx.workspace.id);
  const senderName = config.senderName || profile?.businessName || "the team";
  const first = lead.name.split(" ")[0] || lead.name;
  const body =
    `Hi ${first},\n\n` +
    `I wanted to follow up. ${objective}\n\n` +
    `Happy to jump on a quick call or answer anything over email — just let me know what works.\n\n` +
    `Best,\n${senderName}` +
    (config.signature ? `\n${config.signature}` : "");
  return { to: lead.email, subject: `Following up`, body, leadName: lead.name };
}

/**
 * Execute a single mission step for real, through the existing executor and
 * policy engine. Internal steps (observe/analyze/verify) are reasoning — they
 * complete with no side effect. Steps with a concrete tool actually run it:
 * follow-ups and owner briefs run immediately (low-risk); a send goes through
 * the policy engine, which — for customer replies — creates a REAL Approval
 * with a REAL drafted payload rather than sending blindly. The mission pauses
 * at `waiting_approval` when that happens. Nothing is faked.
 */
async function executeStep(ctx: WorkspaceContext, mission: MissionRow, step: MissionRow["steps"][number]) {
  await db.missionStep.update({ where: { id: step.id }, data: { status: "running", startedAt: new Date() } });

  // Reasoning-only steps: no external effect.
  if (!step.tool) {
    await db.missionStep.update({ where: { id: step.id }, data: { status: "done", finishedAt: new Date() } });
    return { paused: false as const };
  }

  const leadId = mission.subjectType === "lead" ? mission.subjectId ?? undefined : undefined;

  // Owner brief — a real notification (always available, low-risk → runs now).
  if (step.tool === "notify_owner") {
    const out = await executeAction(ctx, {
      tool: "notify_owner",
      input: { title: mission.title, body: mission.objective },
      reason: `Mission "${mission.title}": ${step.title}.`,
      title: mission.title,
    });
    await db.missionStep.update({
      where: { id: step.id },
      data: { status: out.status === "done" ? "done" : "failed", finishedAt: new Date(), actionLogId: out.actionLogId },
    });
    return { paused: false as const };
  }

  // Schedule a follow-up — real, internal, low-risk.
  if (step.tool === "create_followup" && leadId) {
    const out = await executeAction(ctx, {
      tool: "create_followup",
      input: { leadId, inDays: 3, reason: `Mission "${mission.title}"`, message: "" },
      reason: `Mission "${mission.title}": ${step.title}.`,
    });
    await db.missionStep.update({
      where: { id: step.id },
      data: { status: out.status === "done" ? "done" : "skipped", finishedAt: new Date(), actionLogId: out.actionLogId },
    });
    return { paused: false as const };
  }

  // Send a reply — route through the policy engine. For customer replies this
  // returns an Approval (real draft, owner reviews), which pauses the mission.
  if (step.tool === "send_email") {
    if (!leadId) {
      // No single recipient (e.g. reactivation batch) — hold for the owner.
      await db.missionStep.update({ where: { id: step.id }, data: { status: "waiting_approval" } });
      return { paused: true as const };
    }
    const draft = await composeDraftForLead(ctx, leadId, mission.objective);
    if (!draft) {
      await db.missionStep.update({
        where: { id: step.id },
        data: { status: "blocked" as string, finishedAt: new Date(), detail: "No email on file for this lead." },
      });
      return { paused: true as const, blocked: true as const };
    }
    const out = await executeAction(ctx, {
      tool: "send_email",
      input: { to: draft.to, subject: draft.subject, body: draft.body },
      recipientCount: 1,
      reason: `Mission "${mission.title}": send prepared reply to ${draft.leadName}.`,
      title: `Reply to ${draft.leadName}`,
    });
    if (out.status === "done") {
      await db.missionStep.update({
        where: { id: step.id },
        data: { status: "done", finishedAt: new Date(), actionLogId: out.actionLogId },
      });
      return { paused: false as const };
    }
    // approval | blocked | failed → surface for the owner and pause.
    await db.missionStep.update({
      where: { id: step.id },
      data: { status: "waiting_approval", approvalId: out.approvalId, detail: out.reason },
    });
    return { paused: true as const };
  }

  // Unknown tool for this step — hold rather than guess.
  await db.missionStep.update({ where: { id: step.id }, data: { status: "waiting_approval" } });
  return { paused: true as const };
}

/**
 * Advance a mission by executing its next pending step for real (see
 * executeStep). Steps that reach the external-action boundary create a genuine
 * Approval via the policy engine and pause the mission at `waiting_approval`.
 * Safe to call repeatedly (durable/resumable across restarts).
 */
export async function advanceMission(ctx: WorkspaceContext, missionId: string): Promise<MissionWithSteps | null> {
  const mission = await loadMission(ctx, missionId);
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

  const { paused } = await executeStep(ctx, mission, next);
  const updated = await db.mission.update({
    where: { id: mission.id },
    data: { status: paused ? "waiting_approval" : "active", lastActiveAt: new Date() },
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
