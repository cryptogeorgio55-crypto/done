import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { Capability, CapabilityCallContext } from "./types";
import { getConnector, isImplemented } from "./registry";

/** List a workspace's integration accounts (no secrets are ever included). */
export async function listAccounts(workspaceId: string) {
  return db.integrationAccount.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, provider: true, status: true, mode: true, displayName: true,
      scopes: true, health: true, healthDetail: true, lastSyncedAt: true,
      lastErrorAt: true, connectedAt: true,
    },
  });
}

export async function getAccount(workspaceId: string, provider: string) {
  return db.integrationAccount.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
}

/**
 * Connect a provider in SANDBOX mode. This is a real, working connection that
 * operates on a simulated backend — clearly labelled in the UI. It exists so
 * the autonomous loop is fully demonstrable without provider credentials.
 */
export async function connectSandbox(ctx: WorkspaceContext, provider: string) {
  if (!isImplemented(provider)) {
    throw new AppError("not_implemented", "This integration isn't available yet.", 400);
  }
  const account = await db.integrationAccount.upsert({
    where: { workspaceId_provider: { workspaceId: ctx.workspace.id, provider } },
    create: {
      workspaceId: ctx.workspace.id,
      provider,
      mode: "sandbox",
      status: "connected",
      displayName: provider === "gmail" ? "sandbox@yourbusiness.com" : "Sandbox",
      health: "ok",
      connectedAt: new Date(),
      config: { mode: "sandbox" },
    },
    update: { status: "connected", mode: "sandbox", health: "ok", connectedAt: new Date() },
  });

  if (provider === "google_calendar") await seedSandboxCalendar(ctx.workspace.id);

  await audit({
    action: "integration.connected",
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    targetType: "integration",
    targetId: account.id,
    metadata: { provider, mode: "sandbox" },
  });
  return account;
}

export async function disconnect(ctx: WorkspaceContext, provider: string) {
  const account = await getAccount(ctx.workspace.id, provider);
  if (!account) return;
  // Remove tokens and mark disconnected (keep the row for history).
  await db.oAuthToken.deleteMany({ where: { accountId: account.id } });
  await db.integrationAccount.update({
    where: { id: account.id },
    data: { status: "disconnected", health: "unknown" },
  });
  await audit({
    action: "integration.disconnected",
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    targetType: "integration",
    targetId: account.id,
    metadata: { provider },
  });
}

function callContext(ctx: WorkspaceContext, account: { id: string; config: unknown; mode: string }): CapabilityCallContext {
  const cfg = (account.config as Record<string, unknown>) ?? {};
  return { ctx, accountId: account.id, config: { ...cfg, mode: account.mode } };
}

/**
 * Invoke a normalized capability. This is the single choke point for connector
 * calls: it verifies the account exists, is connected, and that the capability
 * is actually granted by that connector before dispatching.
 */
export async function invokeCapability(
  ctx: WorkspaceContext,
  provider: string,
  capability: Capability,
  input: unknown
): Promise<unknown> {
  const account = await getAccount(ctx.workspace.id, provider);
  if (!account || account.status !== "connected") {
    throw new AppError("not_connected", `${provider} is not connected.`, 409);
  }
  const connector = getConnector(provider);
  if (!connector) throw new AppError("not_implemented", "Integration unavailable.", 400);
  if (!connector.capabilities.includes(capability)) {
    throw new AppError("capability_denied", `Not permitted: ${capability}.`, 403);
  }
  return connector.invoke(callContext(ctx, account), capability, input);
}

/** Refresh and persist an account's health status. */
export async function refreshHealth(ctx: WorkspaceContext, provider: string) {
  const account = await getAccount(ctx.workspace.id, provider);
  if (!account) return null;
  const connector = getConnector(provider);
  if (!connector) return null;
  const h = await connector.health(callContext(ctx, account)).catch((e) => ({
    status: "down" as const,
    detail: e instanceof Error ? e.message : "Health check failed",
  }));
  await db.integrationAccount.update({
    where: { id: account.id },
    data: {
      health: h.status,
      healthDetail: h.detail ?? null,
      status: h.status === "down" ? "needs_attention" : "connected",
      ...(h.status === "down" ? { lastErrorAt: new Date() } : {}),
    },
  });
  return h;
}

/** Seed a couple of demo calendar events so availability/briefings have data. */
async function seedSandboxCalendar(workspaceId: string) {
  const existing = await db.externalEntity.count({
    where: { workspaceId, provider: "google_calendar", kind: "event" },
  });
  if (existing > 0) return;

  const today = new Date();
  const at = (h: number, m = 0) => {
    const d = new Date(today); d.setHours(h, m, 0, 0); return d;
  };
  const seeds = [
    { title: "Client call — Karim (Next Level Gym)", start: at(14, 0), dur: 30, attendees: ["karim@nextlevelgym.io"] },
    { title: "Team standup", start: at(10, 0), dur: 15, attendees: [] },
  ];
  for (const s of seeds) {
    await db.externalEntity.create({
      data: {
        workspaceId,
        provider: "google_calendar",
        kind: "event",
        externalId: `evt-seed-${randomUUID().slice(0, 8)}`,
        displayName: s.title,
        data: {
          title: s.title,
          startsAt: s.start.toISOString(),
          endsAt: new Date(s.start.getTime() + s.dur * 60_000).toISOString(),
          attendees: s.attendees,
          location: "",
          notes: "",
        } as unknown as object,
      },
    });
  }
}
