import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getEntitlements, assertWithinLimit } from "@/lib/entitlements";
import { getUsageCount, incrementUsage } from "@/lib/usage";
import { runAutopilotSweep } from "@/lib/autopilot/lazy";

// The insane I'M LAZY — one cross-system DONE Run.
export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`sweep:${ctx.workspace.id}`, 5, 60_000);
  rateLimit(`sweep:ip:${clientIp(req)}`, 10, 60_000);

  // Reuse the existing lazy-run entitlement so autopilot sweeps stay budgeted.
  const ent = await getEntitlements(ctx.workspace.id);
  const used = await getUsageCount(ctx.workspace.id, "lazy_run");
  assertWithinLimit(ent.lazyRunsPerMonth, used, "I'M LAZY runs");

  const result = await runAutopilotSweep(ctx);
  await incrementUsage(ctx.workspace.id, "lazy_run");
  return ok(result);
});
