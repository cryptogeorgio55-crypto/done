import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";

// The DONE Activity feed — every important autonomous action, for transparency.
export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const logs = await db.actionLog.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({
    activity: logs.map((l) => ({
      id: l.id, tool: l.tool, risk: l.risk, status: l.status, decision: l.decision,
      title: l.title, detail: l.detail, reason: l.reason, reversible: l.reversible,
      createdAt: l.createdAt,
    })),
  });
});
