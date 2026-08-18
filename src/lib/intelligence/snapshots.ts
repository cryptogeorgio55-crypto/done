import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { buildTwin, type BusinessTwin } from "@/lib/digital-twin/twin";

/**
 * BUSINESS SNAPSHOTS — capture a small set of grounded metrics at a point in
 * time so the owner can compare "then vs now" without endless charts. Diffing
 * is deterministic; the numbers come straight from the twin.
 */

export type SnapshotMetrics = Record<string, number>;

export function metricsFromTwin(twin: BusinessTwin): SnapshotMetrics {
  return {
    hotLeads: twin.state.sales.hotLeads,
    staleLeads: twin.state.sales.staleLeads,
    followupsDue: twin.state.sales.followupsDue,
    pendingApprovals: twin.state.approvals.pending,
    overdueCommitments: twin.commitments.overdue,
    activeMissions: twin.missions.active.length,
    people: twin.counts.people,
  };
}

/** Capture a snapshot now. De-duplicates to at most one per hour per workspace. */
export async function captureSnapshot(ctx: WorkspaceContext, label?: string): Promise<SnapshotMetrics> {
  const twin = await buildTwin(ctx);
  const metrics = metricsFromTwin(twin);
  const recent = await db.snapshot.findFirst({
    where: { workspaceId: ctx.workspace.id, createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (!recent) {
    await db.snapshot.create({
      data: { workspaceId: ctx.workspace.id, label: label ?? null, metrics: metrics as object },
    });
  }
  return metrics;
}

export interface SnapshotDiff {
  from: { at: string; label: string | null } | null;
  to: { at: string };
  changes: { metric: string; before: number; after: number; delta: number }[];
}

const LABELS: Record<string, string> = {
  hotLeads: "Hot leads",
  staleLeads: "Stale leads",
  followupsDue: "Follow-ups due",
  pendingApprovals: "Pending approvals",
  overdueCommitments: "Overdue promises",
  activeMissions: "Active missions",
  people: "People",
};

/** Diff the most recent stored snapshot against the live twin. */
export async function diffLatest(ctx: WorkspaceContext): Promise<SnapshotDiff> {
  const twin = await buildTwin(ctx);
  const now = metricsFromTwin(twin);
  const prev = await db.snapshot.findFirst({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "desc" },
  });

  // With no baseline yet there is genuinely nothing to compare — say so rather
  // than report every current value as a "change" from zero.
  if (!prev) {
    return { from: null, to: { at: twin.generatedAt }, changes: [] };
  }

  const before = (prev.metrics as SnapshotMetrics) ?? {};
  const changes = Object.keys(now)
    .map((k) => ({
      metric: LABELS[k] ?? k,
      before: before[k] ?? 0,
      after: now[k],
      delta: now[k] - (before[k] ?? 0),
    }))
    .filter((c) => c.delta !== 0);

  return {
    from: { at: prev.createdAt.toISOString(), label: prev.label },
    to: { at: twin.generatedAt },
    changes,
  };
}
