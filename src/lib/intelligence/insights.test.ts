import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace } from "@/test/factory";
import { findOpportunities } from "./opportunities";
import { predict, detectAnomalies } from "./predictions";
import { captureSnapshot, diffLatest } from "./snapshots";

const DAY = 24 * 3600_000;

describe("Opportunity engine (grounded)", () => {
  it("finds no opportunities in an empty workspace", async () => {
    const ctx = await makeWorkspace("Empty Opp Co");
    expect(await findOpportunities(ctx)).toHaveLength(0);
  });

  it("surfaces dormant leads as a reactivation opportunity with a real count", async () => {
    const ctx = await makeWorkspace("Dormant Opp Co");
    for (let i = 0; i < 4; i++) {
      await db.lead.create({
        data: {
          workspaceId: ctx.workspace.id, name: `Old ${i}`, stage: "interested",
          lastContactAt: new Date(Date.now() - 30 * DAY),
        },
      });
    }
    const opps = await findOpportunities(ctx);
    const react = opps.find((o) => o.kind === "reactivation");
    expect(react).toBeTruthy();
    expect(react!.count).toBe(4);
  });
});

describe("Prediction & anomaly engine (grounded, hedged)", () => {
  it("predicts a cooling hot lead that has gone 2+ days quiet", async () => {
    const ctx = await makeWorkspace("Cooling Co");
    await db.lead.create({
      data: {
        workspaceId: ctx.workspace.id, name: "Sarah", stage: "interested",
        lastContactAt: new Date(Date.now() - 2.5 * DAY),
      },
    });
    const preds = await predict(ctx);
    expect(preds.some((p) => p.id.startsWith("cooling:"))).toBe(true);
    // Hedged, never certain.
    expect(preds.every((p) => ["likely", "worth_attention"].includes(p.likelihood))).toBe(true);
  });

  it("flags a lead drought only when the business normally has leads", async () => {
    const ctx = await makeWorkspace("Drought Co");
    for (let i = 0; i < 3; i++) {
      await db.lead.create({
        data: {
          workspaceId: ctx.workspace.id, name: `L${i}`, stage: "contacted",
          createdAt: new Date(Date.now() - 12 * DAY),
        },
      });
    }
    const anomalies = await detectAnomalies(ctx);
    expect(anomalies.some((a) => a.id === "lead_drought")).toBe(true);
  });
});

describe("Snapshots (deterministic diff)", () => {
  it("reports no baseline before the first capture, then diffs real change", async () => {
    const ctx = await makeWorkspace("Snapshot Co");
    const empty = await diffLatest(ctx);
    expect(empty.from).toBeNull();

    await captureSnapshot(ctx, "baseline");
    // Add a hot lead → the next diff should show hotLeads increased.
    await db.lead.create({
      data: { workspaceId: ctx.workspace.id, name: "New", stage: "interested", lastContactAt: new Date() },
    });
    const diff = await diffLatest(ctx);
    expect(diff.from).not.toBeNull();
    const hot = diff.changes.find((c) => c.metric === "Hot leads");
    expect(hot?.delta).toBe(1);
  });
});
