import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { lazySchema } from "@/lib/validation";
import { runLazy } from "@/lib/ai/lazy";

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  // Protect against runaway AI cost: cap Lazy runs per workspace per minute.
  rateLimit(`lazy:${ctx.workspace.id}`, 5, 60_000);
  rateLimit(`lazy:ip:${clientIp(req)}`, 10, 60_000);

  const body = await req.json().catch(() => ({}));
  const input = lazySchema.parse(body);

  const result = await runLazy(ctx, { idempotencyKey: input.idempotencyKey });
  return ok(result);
});
