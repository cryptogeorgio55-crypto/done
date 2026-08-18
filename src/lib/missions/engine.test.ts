import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace } from "@/test/factory";
import { createMissionFromProposal, advanceMission } from "./engine";
import type { AgentProposal } from "@/lib/agents/types";

function salesProposal(leadId: string): AgentProposal {
  return {
    agent: "sales",
    kind: "sales_followup",
    title: "Follow up Sarah now",
    summary: "Sarah is engaged.",
    reason: "High intent.",
    recommendedAction: "Reply and propose next step.",
    priority: "high",
    impact: "high",
    risk: "low",
    requiresApproval: true,
    score: 130,
    subject: { type: "lead", id: leadId, label: "Sarah" },
    toolsRequired: ["draft_reply", "send_message"],
    missionable: true,
  };
}

/** A real lead with an email so the send step can produce a genuine Approval. */
async function makeLead(workspaceId: string) {
  const lead = await import("@/lib/db").then(({ db }) =>
    db.lead.create({
      data: { workspaceId, name: "Sarah Haddad", email: "sarah@example.com", stage: "interested", lastContactAt: new Date() },
    })
  );
  return lead.id;
}

describe("Mission engine (durable, honest)", () => {
  it("creates a mission with a grounded step plan", async () => {
    const ctx = await makeWorkspace("Mission Create Co");
    const m = await createMissionFromProposal(ctx, salesProposal(await makeLead(ctx.workspace.id)));
    expect(m.kind).toBe("sales_close");
    expect(m.steps.length).toBeGreaterThan(0);
    expect(m.steps[0].status).toBe("pending");
    // An external send step must be flagged for approval, never silent.
    expect(m.steps.some((s) => s.kind === "execute" && s.requiresApproval)).toBe(true);
  });

  it("advances internal steps but pauses at the external-action boundary (real Approval)", async () => {
    const ctx = await makeWorkspace("Mission Advance Co");
    const leadId = await makeLead(ctx.workspace.id);
    const m = await createMissionFromProposal(ctx, salesProposal(leadId));

    let current = m;
    // Advance repeatedly; it must never silently send — it pauses for approval.
    for (let i = 0; i < 10; i++) {
      const next = await advanceMission(ctx, current.id);
      if (!next) break;
      current = next;
      if (current.status === "waiting_approval") break;
    }
    expect(current.status).toBe("waiting_approval");
    // The paused step is the execute step, now waiting for approval.
    const paused = current.steps.find((s) => s.status === "waiting_approval");
    expect(paused?.kind).toBe("execute");
    // Internal steps before it are done.
    expect(current.steps.filter((s) => s.status === "done").length).toBeGreaterThan(0);
    // A REAL Approval was created by the policy engine (not a faked send).
    const { db } = await import("@/lib/db");
    const approvals = await db.approval.count({ where: { workspaceId: ctx.workspace.id, status: "pending" } });
    expect(approvals).toBe(1);
  });

  it("survives a reload: a persisted mission is resumable by id", async () => {
    const ctx = await makeWorkspace("Mission Durable Co");
    const m = await createMissionFromProposal(ctx, salesProposal(await makeLead(ctx.workspace.id)));
    await advanceMission(ctx, m.id);

    // Simulate a fresh process: re-read purely from the database.
    const reloaded = await db.mission.findUnique({
      where: { id: m.id },
      include: { steps: { orderBy: { seq: "asc" } } },
    });
    expect(reloaded).toBeTruthy();
    expect(reloaded!.steps[0].status).toBe("done");

    // And it can still be advanced further.
    const again = await advanceMission(ctx, m.id);
    expect(again).toBeTruthy();
  });
});
