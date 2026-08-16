import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit } from "@/lib/rate-limit";
import { campaignGenerateSchema } from "@/lib/validation";
import { generateCampaign } from "@/lib/ai/generate";

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const campaigns = await db.campaign.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { assets: { orderBy: { position: "asc" } } },
    take: 50,
  });
  return ok({ campaigns });
});

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`campaign:${ctx.workspace.id}`, 10, 60_000);
  const input = campaignGenerateSchema.parse(await req.json().catch(() => ({})));
  const { campaign, offline } = await generateCampaign(ctx, {
    objective: input.objective,
    source: "get_customers",
  });
  return ok({ campaign, offline }, 201);
});
