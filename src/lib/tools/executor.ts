import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { ActionCategory, ActionRisk, PolicyDecision } from "@/lib/autonomy/types";
import { getAutonomyConfig } from "@/lib/autonomy/settings";
import { decidePolicy } from "@/lib/autonomy/policy";
import { getTool } from "./registry";
import { audit } from "@/lib/audit";

// The EXECUTOR. Given a requested action it:
//   1. validates the tool + input,
//   2. asks the policy engine what's allowed,
//   3. runs it automatically, queues an Approval, or blocks it,
//   4. records an ActionLog (the DONE Activity feed) + AutomationStep,
// enforcing a per-workspace daily action cap. Nothing here trusts the model.

export interface ActionRequest {
  tool: string;
  input: unknown;
  /** Policy category override; defaults to the tool's category. */
  category?: ActionCategory;
  risk?: ActionRisk;
  recipientCount?: number;
  confidence?: number;
  reason?: string;
  title?: string;
  runId?: string;
  seq?: number;
}

export interface ExecutionOutcome {
  status: "done" | "approval" | "blocked" | "failed";
  decision: PolicyDecision;
  reason: string;
  approvalId?: string;
  actionLogId?: string;
  output?: unknown;
  error?: string;
}

async function autoActionsToday(workspaceId: string): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return db.actionLog.count({
    where: { workspaceId, decision: "auto", status: "success", createdAt: { gte: start } },
  });
}

export async function executeAction(ctx: WorkspaceContext, req: ActionRequest): Promise<ExecutionOutcome> {
  const tool = getTool(req.tool);
  if (!tool) throw new AppError("unknown_tool", `Unknown tool: ${req.tool}`, 400);

  // 1. Validate input against the tool's schema (reject malformed).
  const input = tool.inputSchema.parse(req.input);
  const category = req.category ?? tool.category;
  const title = req.title ?? tool.preview(input);

  // 2. Policy decision.
  const config = await getAutonomyConfig(ctx.workspace.id);
  const policy = decidePolicy(config, {
    category,
    risk: req.risk ?? tool.risk,
    recipientCount: req.recipientCount,
    confidence: req.confidence,
  });

  // 3a. Blocked outright.
  if (policy.decision === "never" || policy.decision === "ignore") {
    const log = await writeActionLog(ctx, {
      runId: req.runId, tool: tool.name, risk: policy.risk, status: "blocked",
      decision: policy.decision, title, reason: policy.reason,
    });
    await writeStep(req, tool.name, policy.risk, "blocked", input, undefined, policy);
    return { status: "blocked", decision: policy.decision, reason: policy.reason, actionLogId: log.id };
  }

  // 3b. Needs approval → create Approval + pending log.
  if (policy.decision === "approval") {
    const approval = await db.approval.create({
      data: {
        workspaceId: ctx.workspace.id,
        runId: req.runId ?? null,
        title,
        actionType: tool.name,
        risk: policy.risk,
        previewText: tool.preview(input),
        reason: req.reason ?? policy.reason,
        payload: { tool: tool.name, input, category } as unknown as Prisma.InputJsonValue,
        status: "pending",
      },
    });
    const log = await writeActionLog(ctx, {
      runId: req.runId, tool: tool.name, risk: policy.risk, status: "pending_approval",
      decision: "approval", title, reason: req.reason ?? policy.reason,
    });
    await writeStep(req, tool.name, policy.risk, "approval", input, undefined, policy);
    return { status: "approval", decision: "approval", reason: policy.reason, approvalId: approval.id, actionLogId: log.id };
  }

  // 3c. Auto — enforce daily cap, then run.
  if ((await autoActionsToday(ctx.workspace.id)) >= config.dailyActionLimit) {
    const approval = await db.approval.create({
      data: {
        workspaceId: ctx.workspace.id, runId: req.runId ?? null, title, actionType: tool.name,
        risk: policy.risk, previewText: tool.preview(input),
        reason: "Daily automatic-action limit reached — queued for approval.",
        payload: { tool: tool.name, input, category } as unknown as Prisma.InputJsonValue, status: "pending",
      },
    });
    return { status: "approval", decision: "approval", reason: "Daily limit reached.", approvalId: approval.id };
  }

  try {
    const result = await tool.run(ctx, input);
    const log = await writeActionLog(ctx, {
      runId: req.runId, tool: tool.name, risk: policy.risk, status: "success", decision: "auto",
      title: result.detail || title, reason: req.reason ?? policy.reason,
      reversible: result.reversible, targetType: result.targetType, targetId: result.targetId,
    });
    await writeStep(req, tool.name, policy.risk, "done", input, result.output, policy);
    return { status: "done", decision: "auto", reason: policy.reason, output: result.output, actionLogId: log.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    await writeActionLog(ctx, {
      runId: req.runId, tool: tool.name, risk: policy.risk, status: "failed", decision: "auto",
      title, reason: message,
    });
    await writeStep(req, tool.name, policy.risk, "failed", input, undefined, policy, message);
    return { status: "failed", decision: "auto", reason: policy.reason, error: message };
  }
}

/** Execute a previously-created approval (owner clicked Approve). */
export async function executeApproval(
  ctx: WorkspaceContext,
  approvalId: string,
  editedPayload?: unknown
): Promise<ExecutionOutcome> {
  const approval = await db.approval.findFirst({
    where: { id: approvalId, workspaceId: ctx.workspace.id },
  });
  if (!approval) throw new AppError("not_found", "Approval not found.", 404);
  if (approval.status !== "pending") throw new AppError("already_decided", "This approval was already handled.", 409);

  const stored = approval.payload as { tool: string; input: unknown; category?: ActionCategory };
  const tool = getTool(stored.tool);
  if (!tool) throw new AppError("unknown_tool", "The tool for this action is unavailable.", 400);

  const input = tool.inputSchema.parse(editedPayload ?? stored.input);
  try {
    const result = await tool.run(ctx, input);
    await db.approval.update({
      where: { id: approval.id },
      data: { status: "executed", decidedById: ctx.user.id, decidedAt: new Date(), executedAt: new Date(), payload: { tool: stored.tool, input, category: stored.category } as unknown as Prisma.InputJsonValue },
    });
    const log = await writeActionLog(ctx, {
      runId: approval.runId, tool: tool.name, risk: approval.risk as ActionRisk, status: "success",
      decision: "approval", title: result.detail || approval.title, reason: "Approved by you.",
      reversible: result.reversible, targetType: result.targetType, targetId: result.targetId,
    });
    await audit({ action: "approval.executed", workspaceId: ctx.workspace.id, actorId: ctx.user.id, targetType: "approval", targetId: approval.id, metadata: { tool: tool.name } });
    return { status: "done", decision: "approval", reason: "Approved.", output: result.output, actionLogId: log.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    await db.approval.update({ where: { id: approval.id }, data: { status: "failed", decidedById: ctx.user.id, decidedAt: new Date() } });
    return { status: "failed", decision: "approval", reason: message, error: message };
  }
}

export async function rejectApproval(ctx: WorkspaceContext, approvalId: string): Promise<void> {
  const approval = await db.approval.findFirst({ where: { id: approvalId, workspaceId: ctx.workspace.id } });
  if (!approval) throw new AppError("not_found", "Approval not found.", 404);
  if (approval.status !== "pending") return;
  await db.approval.update({ where: { id: approval.id }, data: { status: "rejected", decidedById: ctx.user.id, decidedAt: new Date() } });
  await audit({ action: "approval.rejected", workspaceId: ctx.workspace.id, actorId: ctx.user.id, targetType: "approval", targetId: approval.id });
}

// --- internal helpers ------------------------------------------------------

async function writeActionLog(
  ctx: WorkspaceContext,
  a: {
    runId?: string | null; tool: string; risk: ActionRisk;
    status: "success" | "failed" | "blocked" | "pending_approval";
    decision: PolicyDecision; title: string; reason?: string;
    reversible?: boolean; targetType?: string; targetId?: string;
  }
) {
  return db.actionLog.create({
    data: {
      workspaceId: ctx.workspace.id, runId: a.runId ?? null, tool: a.tool, risk: a.risk,
      status: a.status, decision: a.decision, title: a.title, reason: a.reason ?? null,
      reversible: a.reversible ?? false, targetType: a.targetType ?? null, targetId: a.targetId ?? null,
    },
  });
}

async function writeStep(
  req: ActionRequest, tool: string, risk: ActionRisk,
  status: string, input: unknown, output: unknown,
  policy: { decision: PolicyDecision; reason: string }, error?: string
) {
  if (!req.runId) return;
  await db.automationStep.create({
    data: {
      runId: req.runId, seq: req.seq ?? 0, tool, risk, status,
      input: (input as Prisma.InputJsonValue) ?? undefined,
      output: (output as Prisma.InputJsonValue) ?? undefined,
      decision: policy.decision, reason: policy.reason, error: error ?? null,
    },
  });
}
