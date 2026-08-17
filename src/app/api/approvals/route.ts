import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";

export const GET = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  const status = new URL(req.url).searchParams.get("status") || "pending";
  const approvals = await db.approval.findMany({
    where: { workspaceId: ctx.workspace.id, ...(status === "all" ? {} : { status }) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({
    approvals: approvals.map((a) => ({
      id: a.id, title: a.title, actionType: a.actionType, risk: a.risk, source: a.source,
      previewText: a.previewText, reason: a.reason, status: a.status,
      payload: a.payload, createdAt: a.createdAt, decidedAt: a.decidedAt,
    })),
  });
});
