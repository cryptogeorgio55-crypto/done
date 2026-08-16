import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit } from "@/lib/rate-limit";
import { generateWeekPlan } from "@/lib/ai/generate";

export const POST = handle(async () => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`plan:${ctx.workspace.id}`, 10, 60_000);
  const { plan, offline } = await generateWeekPlan(ctx);
  return ok({ plan, offline }, 201);
});
