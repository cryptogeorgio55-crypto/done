import { db } from "@/lib/db";

/** Current monthly bucket key, e.g. "2026-08". Server clock is authoritative. */
export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type UsageMetric = "ai_generation" | "lazy_run" | "campaign" | "content";

/** Read the current count for a metric in the current period. */
export async function getUsageCount(
  workspaceId: string,
  metric: UsageMetric,
  period = currentPeriod()
): Promise<number> {
  const record = await db.usageRecord.findUnique({
    where: { workspaceId_metric_period: { workspaceId, metric, period } },
  });
  return record?.count ?? 0;
}

/**
 * Atomically increment a usage counter. Uses an upsert so concurrent requests
 * can't lose increments. Returns the new count.
 */
export async function incrementUsage(
  workspaceId: string,
  metric: UsageMetric,
  by = 1,
  period = currentPeriod()
): Promise<number> {
  const record = await db.usageRecord.upsert({
    where: { workspaceId_metric_period: { workspaceId, metric, period } },
    create: { workspaceId, metric, period, count: by },
    update: { count: { increment: by } },
  });
  return record.count;
}

/** Snapshot of all metrics this period, for dashboards/analytics. */
export async function getUsageSnapshot(workspaceId: string, period = currentPeriod()) {
  const records = await db.usageRecord.findMany({ where: { workspaceId, period } });
  const map: Record<UsageMetric, number> = {
    ai_generation: 0,
    lazy_run: 0,
    campaign: 0,
    content: 0,
  };
  for (const r of records) {
    if (r.metric in map) map[r.metric as UsageMetric] = r.count;
  }
  return map;
}
