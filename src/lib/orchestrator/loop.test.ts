import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace } from "@/test/factory";
import { connectSandbox, invokeCapability } from "@/lib/connectors/accounts";
import { syncWorkspace } from "@/lib/events/bus";
import { processNewEvents } from "@/lib/orchestrator";
import { executeAction } from "@/lib/tools/executor";
import { updateAutonomyConfig } from "@/lib/autonomy/settings";
import type { WorkspaceContext } from "@/lib/workspace/context";

describe("DONE Loop end-to-end (offline)", () => {
  let ctx: WorkspaceContext;

  beforeAll(async () => {
    ctx = await makeWorkspace("Website Studio");
    // Full autopilot, 24/7 hours so auto sends actually fire in the test.
    await updateAutonomyConfig(ctx.workspace.id, {
      level: "autopilot",
      businessHours: { timezone: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
    });
    await connectSandbox(ctx, "gmail");
    await connectSandbox(ctx, "google_calendar");
  });

  it("ingests sandbox emails as events and dedupes on re-sync", async () => {
    const first = await syncWorkspace(ctx);
    expect(first.ingested).toBeGreaterThanOrEqual(3);
    const second = await syncWorkspace(ctx);
    expect(second.ingested).toBe(0); // dedupe — nothing new the second time
    const count = await db.event.count({ where: { workspaceId: ctx.workspace.id, type: "email.received" } });
    expect(count).toBe(3);
  });

  it("runs the loop: classifies, creates leads, sends safe replies, escalates complaints", async () => {
    const results = await processNewEvents(ctx, 10);
    expect(results.length).toBeGreaterThanOrEqual(3);

    // Leads created for the sales + scheduling inquiries (not the complaint).
    const leads = await db.lead.count({ where: { workspaceId: ctx.workspace.id, deletedAt: null } });
    expect(leads).toBeGreaterThanOrEqual(2);

    // Sales/scheduling replies auto-sent under autopilot.
    const sent = await db.externalEntity.count({
      where: { workspaceId: ctx.workspace.id, provider: "gmail", kind: "message" },
    });
    expect(sent).toBeGreaterThan(3); // 3 inbound + at least 2 sent

    // The complaint requires approval (never auto-sent).
    const pending = await db.approval.count({ where: { workspaceId: ctx.workspace.id, status: "pending" } });
    expect(pending).toBeGreaterThanOrEqual(1);

    // Activity feed recorded successful auto actions.
    const successes = await db.actionLog.count({ where: { workspaceId: ctx.workspace.id, status: "success" } });
    expect(successes).toBeGreaterThanOrEqual(3);

    // All processed events are marked processed.
    const unprocessed = await db.event.count({ where: { workspaceId: ctx.workspace.id, status: "new" } });
    expect(unprocessed).toBe(0);
  });

  it("is idempotent — reprocessing does not double-act", async () => {
    const before = await db.actionLog.count({ where: { workspaceId: ctx.workspace.id } });
    await processNewEvents(ctx, 10); // nothing is "new" anymore
    const after = await db.actionLog.count({ where: { workspaceId: ctx.workspace.id } });
    expect(after).toBe(before);
  });

  it("enforces tenant isolation across workspaces", async () => {
    const other = await makeWorkspace("Other Co");
    expect(await db.event.count({ where: { workspaceId: other.workspace.id } })).toBe(0);
    expect(await db.approval.count({ where: { workspaceId: other.workspace.id } })).toBe(0);
    expect(await db.lead.count({ where: { workspaceId: other.workspace.id } })).toBe(0);
    expect(await db.actionLog.count({ where: { workspaceId: other.workspace.id } })).toBe(0);
  });

  it("blocks capability calls on unconnected accounts", async () => {
    const other = await makeWorkspace("No Integrations Co");
    await expect(
      invokeCapability(other, "gmail", "gmail.search_messages", { query: "test" })
    ).rejects.toThrow();
  });

  it("a send_email tool call fails cleanly when Gmail isn't connected", async () => {
    const other = await makeWorkspace("Disconnected Co");
    // Autopilot + 24/7 so policy would allow an auto send — but there's no Gmail.
    await updateAutonomyConfig(other.workspace.id, {
      level: "autopilot",
      businessHours: { timezone: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
    });
    const outcome = await executeAction(other, {
      tool: "send_email",
      input: { to: "someone@example.com", subject: "Hi", body: "Test" },
      category: "customer_reply",
      confidence: 0.99,
    });
    // Execution must fail (no connection) — never silently "succeed".
    expect(outcome.status).toBe("failed");
  });
});
