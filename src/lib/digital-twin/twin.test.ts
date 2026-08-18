import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace } from "@/test/factory";
import { buildTwin } from "./twin";

const DAY = 24 * 3600_000;

describe("Business Digital Twin (grounded, deterministic)", () => {
  it("an empty workspace produces an empty-but-valid twin", async () => {
    const ctx = await makeWorkspace("Empty Twin Co");
    const twin = await buildTwin(ctx);
    expect(twin.people.hot).toHaveLength(0);
    expect(twin.people.stale).toHaveLength(0);
    expect(twin.commitments.overdue).toBe(0);
    expect(twin.missions.active).toHaveLength(0);
  });

  it("classifies a recently-active lead as hot", async () => {
    const ctx = await makeWorkspace("Hot Twin Co");
    await db.lead.create({
      data: {
        workspaceId: ctx.workspace.id, name: "Sarah", stage: "interested",
        lastContactAt: new Date(Date.now() - 2 * 3600_000),
      },
    });
    const twin = await buildTwin(ctx);
    expect(twin.people.hot).toHaveLength(1);
    expect(twin.people.hot[0].temperature).toBe("hot");
    expect(twin.people.hot[0].name).toBe("Sarah");
  });

  it("surfaces overdue commitments we owe", async () => {
    const ctx = await makeWorkspace("Commit Twin Co");
    await db.commitment.create({
      data: {
        workspaceId: ctx.workspace.id, direction: "ours", party: "Sarah",
        text: "Send proposal", status: "overdue", dueAt: new Date(Date.now() - DAY),
      },
    });
    const twin = await buildTwin(ctx);
    expect(twin.commitments.ourOpen).toHaveLength(1);
    expect(twin.commitments.overdue).toBe(1);
  });

  it("reflects active missions with step progress", async () => {
    const ctx = await makeWorkspace("Mission Twin Co");
    await db.mission.create({
      data: {
        workspaceId: ctx.workspace.id, kind: "sales_close", title: "Close Sarah",
        objective: "Close Sarah today", status: "active",
        steps: {
          create: [
            { workspaceId: ctx.workspace.id, seq: 0, title: "a", kind: "observe", status: "done" },
            { workspaceId: ctx.workspace.id, seq: 1, title: "b", kind: "prepare", status: "pending" },
          ],
        },
      },
    });
    const twin = await buildTwin(ctx);
    expect(twin.missions.active).toHaveLength(1);
    expect(twin.missions.active[0].progress).toBeCloseTo(0.5);
  });
});
