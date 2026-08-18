import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { buildMorningBrief } from "@/lib/chief-of-staff/brief";

/**
 * CHIEF OF STAFF — the daily executive brief. Read-only, safe to load on open.
 */
export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const brief = await buildMorningBrief(ctx);
  return ok({ brief });
});
