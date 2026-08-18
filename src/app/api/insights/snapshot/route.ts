import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { captureSnapshot } from "@/lib/intelligence/snapshots";

/** POST /api/insights/snapshot — capture a baseline to compare against later. */
export const POST = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const metrics = await captureSnapshot(ctx);
  return ok({ metrics });
});
