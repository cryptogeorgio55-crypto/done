import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { buildBriefing } from "@/lib/autopilot/briefing";

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const briefing = await buildBriefing(ctx);
  return ok({ briefing });
});
