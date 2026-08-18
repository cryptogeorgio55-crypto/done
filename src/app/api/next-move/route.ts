import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { buildNextMovesV2 } from "@/lib/intelligence/next-move-v2";

/**
 * NEXT MOVE — the signature intelligence surface. v2 asks the whole agent team
 * (Executive, Sales, Customer, Calendar, Marketing, Operations) via the
 * coordinator, then returns their ranked, grounded, de-duplicated
 * recommendations. Read-only: it never takes an action, so it is safe to poll
 * for a live "what matters now" view. Response shape is unchanged for the UI;
 * `attribution` adds which agent raised each move.
 */
export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const { state, moves, all, agents, attribution } = await buildNextMovesV2(ctx, { limit: 5 });
  return ok({ state, moves, total: all.length, agents, attribution });
});
