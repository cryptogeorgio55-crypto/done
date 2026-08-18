import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace } from "@/test/factory";
import { buildNextMoves, NextMoveSchema } from "./next-move";
import { computeBusinessState } from "./business-state";

const DAY = 24 * 3600_000;

describe("Next Move engine (grounded, offline)", () => {
  it("does not fabricate sales work for an empty workspace", async () => {
    const ctx = await makeWorkspace("Empty Co");
    const { moves } = await buildNextMoves(ctx);
    // No leads/approvals/meetings exist → no sales/approval moves invented.
    // (A low-priority content-gap nudge is legitimate: there is genuinely no content.)
    expect(moves.every((m) => m.type === "content_gap")).toBe(true);
    expect(moves.some((m) => m.priority === "high")).toBe(false);
  });

  it("Case 2: a hot lead (recent inbound) becomes the top high-priority move", async () => {
    const ctx = await makeWorkspace("Hot Lead Co");
    await db.lead.create({
      data: {
        workspaceId: ctx.workspace.id, name: "Sarah Haddad", stage: "interested",
        lastContactAt: new Date(Date.now() - 2 * 3600_000), // 2h ago
      },
    });
    const { moves } = await buildNextMoves(ctx);
    expect(moves.length).toBeGreaterThan(0);
    const top = moves[0];
    expect(top.type).toBe("sales_followup");
    expect(top.priority).toBe("high");
    expect(top.title).toContain("Sarah");
    // Every field is present and schema-valid.
    expect(() => NextMoveSchema.parse(top)).not.toThrow();
    // External send → must route through approval/policy, not fire blindly.
    expect(top.requiresApproval).toBe(true);
    expect(top.entities[0]).toMatchObject({ type: "lead", label: "Sarah Haddad" });
  });

  it("Case 5: several dormant leads produce one reactivation opportunity", async () => {
    const ctx = await makeWorkspace("Dormant Co");
    for (let i = 0; i < 6; i++) {
      await db.lead.create({
        data: {
          workspaceId: ctx.workspace.id, name: `Old Lead ${i}`, stage: "interested",
          lastContactAt: new Date(Date.now() - 30 * DAY),
        },
      });
    }
    const { all } = await buildNextMoves(ctx);
    const reactivation = all.find((m) => m.type === "lead_reactivation");
    expect(reactivation).toBeTruthy();
    expect(reactivation!.title).toContain("6");
    expect(reactivation!.requiresApproval).toBe(true); // bulk communication
  });

  it("Case 3: a pending approval outranks routine work", async () => {
    const ctx = await makeWorkspace("Approvals Co");
    // A low-priority content gap exists, but an approval should sort above it.
    await db.approval.create({
      data: {
        workspaceId: ctx.workspace.id, title: "Reply to complaint", actionType: "send_email",
        risk: "high", reason: "Complaint handling requires your sign-off.", payload: {},
      },
    });
    const { moves } = await buildNextMoves(ctx);
    expect(moves[0].type).toBe("approval");
    expect(moves[0].priority).toBe("high");
    expect(moves[0].requiresApproval).toBe(true);
  });

  it("ranks and caps to the top N (never floods with equal items)", async () => {
    const ctx = await makeWorkspace("Busy Co");
    for (let i = 0; i < 8; i++) {
      await db.lead.create({
        data: {
          workspaceId: ctx.workspace.id, name: `Hot ${i}`, stage: "interested",
          lastContactAt: new Date(Date.now() - (i + 1) * 3600_000),
        },
      });
    }
    const { moves, all } = await buildNextMoves(ctx, { limit: 3 });
    expect(moves).toHaveLength(3);
    expect(all.length).toBeGreaterThan(3);
    // Sorted by descending score.
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].score).toBeGreaterThanOrEqual(all[i].score);
    }
  });

  it("Business State reflects real records", async () => {
    const ctx = await makeWorkspace("State Co");
    await db.lead.create({
      data: { workspaceId: ctx.workspace.id, name: "Fresh", stage: "interested", lastContactAt: new Date() },
    });
    await db.approval.create({
      data: { workspaceId: ctx.workspace.id, title: "x", actionType: "send_email", payload: {} },
    });
    const state = await computeBusinessState(ctx);
    expect(state.sales.hotLeads).toBe(1);
    expect(state.approvals.pending).toBe(1);
    expect(state.marketing.contentGapDays).toBeGreaterThanOrEqual(4);
  });
});
