import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit } from "@/lib/rate-limit";
import { generateFollowUp } from "@/lib/ai/generate";

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`followup:${ctx.workspace.id}`, 30, 60_000);
  // The lead id comes from the URL; generateFollowUp re-checks workspace ownership.
  const id = new URL(req.url).pathname.split("/").slice(-2, -1)[0];
  const { followUp, offline } = await generateFollowUp(ctx, { leadId: id });
  return ok({ followUp, offline });
});
