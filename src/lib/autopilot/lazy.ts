import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { syncWorkspace } from "@/lib/events/bus";
import { processNewEvents } from "@/lib/orchestrator";
import { executeAction } from "@/lib/tools/executor";

// THE INSANE I'M LAZY.
//
// Pressing I'M LAZY now reasons ACROSS connected systems: it pulls new events,
// runs them through the DONE Loop, chases stale leads, and surfaces gaps —
// producing a single "DONE Run" with a list of everything it handled and
// anything that needs approval.

export interface RunItem {
  title: string;
  status: "done" | "approval" | "blocked" | "info";
  detail?: string;
}

export interface AutopilotSweepResult {
  runId: string;
  message: string;
  items: RunItem[];
  actionsDone: number;
  approvals: number;
}

export async function runAutopilotSweep(ctx: WorkspaceContext): Promise<AutopilotSweepResult> {
  const wsId = ctx.workspace.id;
  const run = await db.automationRun.create({
    data: { workspaceId: wsId, trigger: "lazy", status: "running", intent: "sweep" },
  });

  const items: RunItem[] = [];
  let actionsDone = 0;
  let approvals = 0;

  // 1. OBSERVE — pull anything new from connected systems and process it.
  await syncWorkspace(ctx);
  const loopResults = await processNewEvents(ctx, 10);
  for (const r of loopResults) {
    actionsDone += r.actionsDone;
    approvals += r.approvals;
    items.push({
      title: r.message,
      status: r.approvals > 0 ? "approval" : r.actionsDone > 0 ? "done" : "info",
      detail: r.summary,
    });
  }

  // 2. Chase stale leads that have gone quiet.
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600_000);
  const staleLeads = await db.lead.findMany({
    where: {
      workspaceId: wsId, deletedAt: null,
      stage: { in: ["contacted", "interested", "followup"] },
      OR: [{ nextFollowUpAt: { lte: new Date() } }, { lastContactAt: { lte: fourDaysAgo } }],
    },
    orderBy: { lastContactAt: "asc" },
    take: 5,
  });
  for (const lead of staleLeads) {
    const o = await executeAction(ctx, {
      tool: "create_followup", runId: run.id,
      input: { leadId: lead.id, inDays: 2, reason: "Lead went quiet — nudge scheduled.", message: "" },
      reason: `${lead.name} hasn't been contacted recently.`,
    });
    if (o.status === "done") actionsDone++;
    if (o.status === "approval") approvals++;
    items.push({ title: `Follow-up prepared for ${lead.name}`, status: o.status === "failed" ? "info" : o.status, detail: o.reason });
  }

  // 3. Surface a content gap (handled via existing content tools, not auto-posted).
  const lastContent = await db.contentItem.findFirst({
    where: { workspaceId: wsId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
  });
  const daysSince = lastContent ? Math.floor((Date.now() - lastContent.createdAt.getTime()) / (24 * 3600_000)) : 99;
  if (daysSince >= 4) {
    items.push({
      title: "You haven't posted this week",
      status: "info",
      detail: "Head to Content to generate this week's post — I can draft it in one click.",
    });
  }

  if (items.length === 0) {
    items.push({ title: "You're all caught up", status: "info", detail: "Nothing needs handling right now." });
  }

  const message =
    approvals > 0
      ? `I handled ${actionsDone} thing${actionsDone === 1 ? "" : "s"} and left ${approvals} for your approval.`
      : actionsDone > 0
        ? `I handled ${actionsDone} thing${actionsDone === 1 ? "" : "s"} across your business.`
        : `I looked across your business — nothing urgent right now.`;

  await db.automationRun.update({
    where: { id: run.id },
    data: {
      status: approvals > 0 ? "needs_approval" : "completed",
      message, summary: items.map((i) => i.title).join("; ").slice(0, 400),
      actionsDone, approvalsCount: approvals, actionsPlanned: items.length, finishedAt: new Date(),
    },
  });
  await db.notification.create({
    data: { workspaceId: wsId, userId: ctx.user.id, kind: "lazy_completed", title: "DONE ✓", body: message },
  });

  return { runId: run.id, message, items, actionsDone, approvals };
}
