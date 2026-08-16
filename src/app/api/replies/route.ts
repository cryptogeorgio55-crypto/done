import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit } from "@/lib/rate-limit";
import { replyInputSchema } from "@/lib/validation";
import { generateReply } from "@/lib/ai/generate";

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`reply:${ctx.workspace.id}`, 30, 60_000);
  const input = replyInputSchema.parse(await req.json().catch(() => ({})));
  const { reply, offline } = await generateReply(ctx, input);
  return ok({ reply, offline });
});
