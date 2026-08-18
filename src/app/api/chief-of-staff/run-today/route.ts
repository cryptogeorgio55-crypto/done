import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { runToday } from "@/lib/chief-of-staff/brief";

/**
 * RUN TODAY — turn the top missionable recommendations into durable Missions.
 * A write action, so POST only. Missions launch at `prepare` autonomy and stop
 * at the approval boundary — nothing external fires without the owner.
 */
export const POST = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const result = await runToday(ctx, { max: 3 });
  return ok(result);
});
