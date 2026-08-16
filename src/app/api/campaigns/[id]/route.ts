import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { NotFoundError } from "@/lib/errors";

// Workspace-scoped campaign detail — used by the I'M LAZY result reveal.
export const GET = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  const id = new URL(req.url).pathname.split("/").pop()!;
  const campaign = await db.campaign.findFirst({
    where: { id, workspaceId: ctx.workspace.id, deletedAt: null },
    include: { assets: { orderBy: { position: "asc" } } },
  });
  if (!campaign) throw new NotFoundError("Campaign not found.");
  return ok({ campaign });
});
