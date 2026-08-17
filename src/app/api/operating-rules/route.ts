import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { db } from "@/lib/db";

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const rules = await db.operatingRule.findMany({
    where: { workspaceId: ctx.workspace.id, active: true },
    orderBy: { createdAt: "asc" },
  });
  return ok({ rules });
});

const postSchema = z.object({
  category: z.enum(["communication", "sales", "scheduling", "discount", "support", "approval", "escalation"]),
  rule: z.string().min(3).max(400),
});

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const input = postSchema.parse(await req.json().catch(() => ({})));
  const rule = await db.operatingRule.create({
    data: { workspaceId: ctx.workspace.id, category: input.category, rule: input.rule, source: "manual" },
  });
  return ok({ rule }, 201);
});

const delSchema = z.object({ id: z.string() });
export const DELETE = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const { id } = delSchema.parse(await req.json().catch(() => ({})));
  await db.operatingRule.updateMany({ where: { id, workspaceId: ctx.workspace.id }, data: { active: false } });
  return ok({ deleted: true });
});
