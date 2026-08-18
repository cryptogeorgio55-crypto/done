import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { buildTwin, type BusinessTwin } from "@/lib/digital-twin/twin";

/**
 * OPPORTUNITY ENGINE — "money left on the table".
 *
 * Finds concrete, grounded revenue opportunities from real rows: dormant warm
 * leads, unfilled meeting capacity, and past customers who could return. It
 * NEVER fabricates a revenue number — it points at real people/gaps and lets
 * the owner act. Deterministic (zero AI budget).
 */

export interface Opportunity {
  id: string;
  kind: "reactivation" | "unfilled_capacity" | "repeat_customer";
  title: string;
  detail: string;
  /** How many real records back this up — the honest "size" signal. */
  count: number;
  action: string;
}

const DAY = 24 * 3600_000;

export async function findOpportunities(ctx: WorkspaceContext, twin?: BusinessTwin): Promise<Opportunity[]> {
  const t = twin ?? (await buildTwin(ctx));
  const wsId = ctx.workspace.id;
  const out: Opportunity[] = [];

  // 1. Dormant warm leads worth reactivating.
  if (t.people.stale.length >= 2) {
    out.push({
      id: "reactivation",
      kind: "reactivation",
      title: `${t.people.stale.length} dormant leads worth reviving`,
      detail: "These leads showed interest before but have gone quiet for 14+ days.",
      count: t.people.stale.length,
      action: "Prepare personalized reactivation messages.",
    });
  }

  // 2. Unfilled capacity — open slots in the near calendar with warm demand.
  if (t.state.calendar.meetingsNext24h === 0 && t.people.hot.length > 0) {
    out.push({
      id: "unfilled_capacity",
      kind: "unfilled_capacity",
      title: "Open calendar, warm leads waiting",
      detail: `No meetings booked in the next 24h, but ${t.people.hot.length} engaged lead(s) could fill it.`,
      count: t.people.hot.length,
      action: "Offer open times to your warmest leads.",
    });
  }

  // 3. Past customers (won) with no recent contact — repeat-purchase potential.
  const wonQuiet = await db.lead.count({
    where: {
      workspaceId: wsId, deletedAt: null, stage: "won",
      lastContactAt: { lte: new Date(Date.now() - 30 * DAY) },
    },
  });
  if (wonQuiet >= 2) {
    out.push({
      id: "repeat_customer",
      kind: "repeat_customer",
      title: `${wonQuiet} past customers you haven't contacted in a month`,
      detail: "Existing customers are the cheapest source of new revenue.",
      count: wonQuiet,
      action: "Reach out with a returning-customer offer.",
    });
  }

  return out;
}
