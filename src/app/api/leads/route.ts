import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { leadSchema } from "@/lib/validation";
import { getEntitlements, assertWithinLimit } from "@/lib/entitlements";

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const leads = await db.lead.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return ok({ leads });
});

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  const input = leadSchema.parse(await req.json().catch(() => ({})));

  // Enforce plan lead limit.
  const ent = await getEntitlements(ctx.workspace.id);
  const count = await db.lead.count({ where: { workspaceId: ctx.workspace.id, deletedAt: null } });
  assertWithinLimit(ent.leads, count, "leads");

  const lead = await db.lead.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      stage: input.stage,
      notes: input.notes,
      estimatedValue: input.estimatedValue,
    },
  });
  return ok({ lead }, 201);
});
