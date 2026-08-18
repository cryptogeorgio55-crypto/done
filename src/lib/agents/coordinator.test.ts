import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace } from "@/test/factory";
import { runCoordinator } from "./coordinator";
import { AgentProposalSchema } from "./types";

const DAY = 24 * 3600_000;

describe("Agent coordinator (multi-agent, grounded)", () => {
  it("invents no work for an empty workspace and reports all agents idle", async () => {
    const ctx = await makeWorkspace("Empty Agents Co");
    const { proposals, agents } = await runCoordinator(ctx);
    // No leads/approvals/meetings → nothing but (maybe) a content-gap nudge.
    expect(proposals.every((p) => p.kind === "content_gap")).toBe(true);
    expect(proposals.some((p) => p.priority === "high")).toBe(false);
    expect(agents).toHaveLength(6);
  });

  it("the sales agent surfaces a hot lead as a high-priority proposal", async () => {
    const ctx = await makeWorkspace("Sales Agent Co");
    await db.lead.create({
      data: {
        workspaceId: ctx.workspace.id, name: "Sarah Haddad", stage: "interested",
        lastContactAt: new Date(Date.now() - 2 * 3600_000),
      },
    });
    const { proposals } = await runCoordinator(ctx);
    const top = proposals[0];
    expect(top.agent).toBe("sales");
    expect(top.priority).toBe("high");
    expect(top.title).toContain("Sarah");
    expect(top.requiresApproval).toBe(true);
    expect(() => AgentProposalSchema.parse(top)).not.toThrow();
  });

  it("the executive agent surfaces a pending approval above routine work", async () => {
    const ctx = await makeWorkspace("Exec Agent Co");
    await db.approval.create({
      data: {
        workspaceId: ctx.workspace.id, title: "Reply to complaint", actionType: "send_email",
        risk: "high", reason: "Complaint handling requires sign-off.", payload: {},
      },
    });
    const { proposals } = await runCoordinator(ctx);
    expect(proposals[0].agent).toBe("executive");
    expect(proposals[0].subject?.type).toBe("approval");
  });

  it("de-duplicates: a lead that is both hot and follow-up-due yields one proposal", async () => {
    const ctx = await makeWorkspace("Dedupe Co");
    await db.lead.create({
      data: {
        workspaceId: ctx.workspace.id, name: "Dupe Lead", stage: "interested",
        lastContactAt: new Date(Date.now() - 2 * 3600_000),
        nextFollowUpAt: new Date(Date.now() - DAY),
      },
    });
    const { proposals } = await runCoordinator(ctx);
    const forLead = proposals.filter((p) => p.subject?.label === "Dupe Lead");
    expect(forLead).toHaveLength(1);
  });

  it("records an AgentRun per agent for observability", async () => {
    const ctx = await makeWorkspace("Observability Co");
    await runCoordinator(ctx);
    const runs = await db.agentRun.count({ where: { workspaceId: ctx.workspace.id } });
    expect(runs).toBe(6);
  });
});
