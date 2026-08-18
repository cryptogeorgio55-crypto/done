import { handle, ok, fail } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { advanceMission } from "@/lib/missions/engine";

/**
 * POST /api/missions/:id/advance — progress a mission by one step. Internal
 * steps complete deterministically; steps that take an external action pause
 * the mission at `waiting_approval`, where the policy engine takes over. Safe
 * to call repeatedly (durable/resumable).
 */
export const POST = handle(async (_req, _ctx2) => {
  const ctx = await requireWorkspaceContext();
  const id = _req.url.split("/missions/")[1]?.split("/")[0];
  if (!id) return fail("bad_request", "Missing mission id.", 400);
  const mission = await advanceMission(ctx, decodeURIComponent(id));
  if (!mission) return fail("not_found", "Mission not found.", 404);
  return ok({ mission });
});
