import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { analyzeDecision } from "@/lib/intelligence/decision-room";

const schema = z.object({ question: z.string().min(6).max(600) });

// DECISION ROOM — analyze a business decision. Reasoning-tier, server-side only.
export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`decision:${ctx.workspace.id}`, 8, 60_000);
  rateLimit(`decision:ip:${clientIp(req)}`, 15, 60_000);

  const body = await req.json().catch(() => ({}));
  const { question } = schema.parse(body);

  const result = await analyzeDecision(ctx, question);
  return ok(result);
});
