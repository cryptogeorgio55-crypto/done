import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace } from "@/test/factory";
import { buildMorningBrief, runToday } from "./brief";

describe("Chief of Staff (grounded brief + Run Today)", () => {
  it("produces a calm brief for a quiet workspace", async () => {
    const ctx = await makeWorkspace("Quiet Co");
    const brief = await buildMorningBrief(ctx);
    // Even a quiet night yields a "nothing new" line, never an empty brief.
    expect(brief.whatChanged.length).toBeGreaterThan(0);
    expect(brief.recommendation).toBeTruthy();
  });

  it("names the biggest opportunity from a real hot lead", async () => {
    const ctx = await makeWorkspace("Brief Co");
    await db.lead.create({
      data: {
        workspaceId: ctx.workspace.id, name: "Sarah Haddad", stage: "interested",
        lastContactAt: new Date(Date.now() - 3600_000),
      },
    });
    const brief = await buildMorningBrief(ctx);
    expect(brief.biggestOpportunity?.title).toContain("Sarah");
    expect(brief.plan.length).toBeGreaterThan(0);
  });

  it("Run Today launches durable missions from missionable proposals", async () => {
    const ctx = await makeWorkspace("Run Today Co");
    await db.lead.create({
      data: {
        workspaceId: ctx.workspace.id, name: "Sarah Haddad", email: "sarah@example.com",
        stage: "interested", lastContactAt: new Date(Date.now() - 3600_000),
      },
    });
    const res = await runToday(ctx);
    expect(res.launched.length).toBeGreaterThan(0);
    const missions = await db.mission.count({ where: { workspaceId: ctx.workspace.id } });
    expect(missions).toBe(res.launched.length);

    // Running again reuses the existing mission for the same lead (no duplicate).
    const res2 = await runToday(ctx);
    expect(res2.skipped).toBeGreaterThan(0);
  });
});
