import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";

const CATEGORY_ORDER = ["needs_attention", "sales", "customers", "operations", "finance", "meetings", "marketing", "done_auto"];

export const GET = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  const category = new URL(req.url).searchParams.get("category") || undefined;

  const events = await db.event.findMany({
    where: { workspaceId: ctx.workspace.id, ...(category ? { category } : {}) },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  // Category counts for the Inbox filter chips.
  const grouped = await db.event.groupBy({
    by: ["category"],
    where: { workspaceId: ctx.workspace.id },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const g of grouped) if (g.category) counts[g.category] = g._count._all;

  return ok({
    events: events.map((e) => ({
      id: e.id, type: e.type, source: e.source, category: e.category, status: e.status,
      title: e.title, summary: e.summary, urgency: e.urgency, confidence: e.confidence,
      occurredAt: e.occurredAt, runId: e.runId,
    })),
    counts,
    categoryOrder: CATEGORY_ORDER,
  });
});
