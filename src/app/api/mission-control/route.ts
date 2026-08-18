import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { runCoordinator } from "@/lib/agents/coordinator";
import { computeGoalProgress } from "@/lib/goals/engine";
import { db } from "@/lib/db";

/**
 * MISSION CONTROL — the live picture of everything the AI team is doing.
 * Runs the coordinator (real agents over the real Digital Twin), and joins in
 * active missions and goal progress. Read-only, safe to poll.
 */
export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const [{ twin, proposals, agents }, missions, actionsToday] = await Promise.all([
    runCoordinator(ctx),
    db.mission.findMany({
      where: { workspaceId: ctx.workspace.id, status: { in: ["active", "waiting_approval", "blocked"] } },
      orderBy: { priority: "desc" },
      include: { steps: { orderBy: { seq: "asc" }, select: { status: true } } },
      take: 10,
    }),
    db.actionLog.count({
      where: {
        workspaceId: ctx.workspace.id,
        status: "success",
        createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
      },
    }),
  ]);

  const goals = await computeGoalProgress(ctx, twin);

  return ok({
    generatedAt: twin.generatedAt,
    agents,
    activeMissions: missions.map((m) => {
      const total = m.steps.length || 1;
      const done = m.steps.filter((s) => s.status === "done").length;
      return { id: m.id, title: m.title, kind: m.kind, status: m.status, progress: done / total };
    }),
    waiting: { approvals: twin.state.approvals.pending, missions: twin.missions.waitingApproval },
    completedToday: actionsToday,
    topProposals: proposals.slice(0, 5),
    goals,
  });
});
