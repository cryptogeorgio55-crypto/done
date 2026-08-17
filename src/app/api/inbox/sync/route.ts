import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit } from "@/lib/rate-limit";
import { syncWorkspace } from "@/lib/events/bus";
import { processNewEvents } from "@/lib/orchestrator";

// Poll connected integrations for new events and (optionally) run the DONE Loop.
export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`sync:${ctx.workspace.id}`, 10, 60_000);
  const body = await req.json().catch(() => ({}));
  const process = body?.process !== false;

  const { ingested } = await syncWorkspace(ctx);
  const results = process ? await processNewEvents(ctx, 10) : [];
  const actionsDone = results.reduce((s, r) => s + r.actionsDone, 0);
  const approvals = results.reduce((s, r) => s + r.approvals, 0);

  return ok({ ingested, processed: results.length, actionsDone, approvals });
});
