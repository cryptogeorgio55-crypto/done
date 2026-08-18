import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace } from "@/test/factory";
import { detectCommitments, inferDueAt, recordCommitments, markOverdueCommitments } from "./tracker";

describe("Commitment tracker (deterministic)", () => {
  it("detects a promise WE made and infers tomorrow as the due date", () => {
    const found = detectCommitments("Thanks! I'll send the proposal tomorrow.", true);
    expect(found).toHaveLength(1);
    expect(found[0].direction).toBe("ours");
    expect(found[0].dueAt).toBeInstanceOf(Date);
  });

  it("detects a promise THEY made without chasing early", () => {
    const found = detectCommitments("Sounds good, I'll confirm Friday.", false);
    expect(found[0].direction).toBe("theirs");
  });

  it("does not fabricate a commitment from neutral text", () => {
    expect(detectCommitments("The weather is nice and the office is open.", true)).toHaveLength(0);
  });

  it("inferDueAt resolves 'tomorrow' to a future date", () => {
    const base = new Date("2026-08-18T09:00:00Z");
    const due = inferDueAt("I'll do it tomorrow", base);
    expect(due).not.toBeNull();
    expect(due!.getTime()).toBeGreaterThan(base.getTime());
  });

  it("persists and de-duplicates commitments per workspace", async () => {
    const ctx = await makeWorkspace("Promise Co");
    const n1 = await recordCommitments(ctx, {
      text: "I'll send Sarah the proposal tomorrow.",
      authorIsUs: true, party: "Sarah",
    });
    expect(n1).toBe(1);
    // Same promise again → no duplicate.
    const n2 = await recordCommitments(ctx, {
      text: "I'll send Sarah the proposal tomorrow.",
      authorIsUs: true, party: "Sarah",
    });
    expect(n2).toBe(0);
    const count = await db.commitment.count({ where: { workspaceId: ctx.workspace.id } });
    expect(count).toBe(1);
  });

  it("marks past-due commitments overdue", async () => {
    const ctx = await makeWorkspace("Overdue Co");
    await db.commitment.create({
      data: {
        workspaceId: ctx.workspace.id, direction: "ours", party: "Bob",
        text: "Send Bob the quote", status: "open", dueAt: new Date(Date.now() - 3600_000),
      },
    });
    const flipped = await markOverdueCommitments(ctx);
    expect(flipped).toBe(1);
    const c = await db.commitment.findFirst({ where: { workspaceId: ctx.workspace.id } });
    expect(c!.status).toBe("overdue");
  });
});
