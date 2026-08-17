import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { NormalizedEvent } from "./types";
import { getConnector } from "@/lib/connectors/registry";
import { listAccounts } from "@/lib/connectors/accounts";

// The event bus: connectors produce NormalizedEvents; ingest() persists them
// with per-workspace dedupe; processPendingEvents() feeds them into the DONE
// Loop. In production the "process" step would be a durable queue worker — here
// it runs inline but is idempotent (status transitions guard re-processing).

/** Persist a normalized event, ignoring duplicates (per-workspace dedupeKey). */
export async function ingest(workspaceId: string, ev: NormalizedEvent): Promise<{ id: string; created: boolean } | null> {
  const existing = await db.event.findUnique({
    where: { workspaceId_dedupeKey: { workspaceId, dedupeKey: ev.dedupeKey } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const row = await db.event.create({
    data: {
      workspaceId,
      type: ev.type,
      source: ev.source,
      status: "new",
      dedupeKey: ev.dedupeKey,
      title: ev.title ?? null,
      summary: ev.summary ?? null,
      payload: (ev.payload as Prisma.InputJsonValue) ?? {},
      entityId: ev.entityId ?? null,
      occurredAt: ev.occurredAt ?? new Date(),
    },
    select: { id: true },
  });
  return { id: row.id, created: true };
}

/** Poll every connected account and ingest what they observe. */
export async function syncWorkspace(ctx: WorkspaceContext): Promise<{ ingested: number }> {
  const accounts = await listAccounts(ctx.workspace.id);
  let ingested = 0;
  for (const account of accounts) {
    if (account.status !== "connected") continue;
    const connector = getConnector(account.provider);
    if (!connector) continue;
    const cfg = { mode: account.mode };
    try {
      const events = await connector.poll({ ctx, accountId: account.id, config: cfg });
      for (const ev of events) {
        const res = await ingest(ctx.workspace.id, ev);
        if (res?.created) ingested++;
      }
      await db.integrationAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date(), health: "ok" },
      });
    } catch (err) {
      await db.integrationAccount.update({
        where: { id: account.id },
        data: { health: "down", healthDetail: err instanceof Error ? err.message : "sync failed", lastErrorAt: new Date() },
      });
    }
  }
  return { ingested };
}

export async function countNewEvents(workspaceId: string): Promise<number> {
  return db.event.count({ where: { workspaceId, status: "new" } });
}
