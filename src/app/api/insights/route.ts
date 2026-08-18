import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { buildTwin } from "@/lib/digital-twin/twin";
import { findOpportunities } from "@/lib/intelligence/opportunities";
import { predict, detectAnomalies } from "@/lib/intelligence/predictions";
import { diffLatest } from "@/lib/intelligence/snapshots";

/**
 * INSIGHTS — the proactive intelligence surface: money left on the table
 * (opportunities), hedged predictions, statistical anomalies, and a since-last
 * snapshot diff. All grounded and deterministic; read-only.
 */
export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const twin = await buildTwin(ctx);
  const [opportunities, predictions, anomalies, snapshot] = await Promise.all([
    findOpportunities(ctx, twin),
    predict(ctx, twin),
    detectAnomalies(ctx),
    diffLatest(ctx),
  ]);
  return ok({ opportunities, predictions, anomalies, snapshot });
});
