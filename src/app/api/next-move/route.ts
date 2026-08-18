import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { buildNextMoves } from "@/lib/intelligence/next-move";

/**
 * NEXT MOVE — the signature intelligence surface. Returns the ranked, grounded
 * recommendations derived from the workspace's real state. Read-only: it never
 * takes an action, so it is safe to poll for a live "what matters now" view.
 */
export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const { state, moves, all } = await buildNextMoves(ctx, { limit: 5 });
  return ok({ state, moves, total: all.length });
});
