import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit } from "@/lib/rate-limit";
import { contentSchema } from "@/lib/validation";
import { generateContent } from "@/lib/ai/generate";

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const items = await db.contentItem.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({ items });
});

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`content:${ctx.workspace.id}`, 20, 60_000);
  const input = contentSchema.parse(await req.json().catch(() => ({})));
  const { item, offline } = await generateContent(ctx, { type: input.type });
  return ok({ item, offline }, 201);
});
