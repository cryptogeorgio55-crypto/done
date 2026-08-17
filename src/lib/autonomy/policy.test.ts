import { describe, it, expect } from "vitest";
import { decidePolicy, withinBusinessHours } from "./policy";
import type { AutonomyConfig } from "./types";

function config(over: Partial<AutonomyConfig> = {}): AutonomyConfig {
  return {
    level: "autopilot",
    paused: false,
    categoryPolicies: {
      sales_reply: "auto", customer_reply: "auto", complaint: "approval",
      financial: "never", schedule_meeting: "auto", send_quotation: "approval",
      send_followup: "auto", update_lead: "auto", create_lead: "auto",
      internal_task: "auto", bulk_communication: "approval", destructive: "never",
    },
    businessHours: { timezone: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
    dailyActionLimit: 50,
    monthlyAiBudget: null,
    ...over,
  };
}

describe("policy engine", () => {
  it("allows configured auto actions in-hours", () => {
    const r = decidePolicy(config(), { category: "sales_reply", confidence: 0.9 });
    expect(r.decision).toBe("auto");
  });

  it("NEVER auto-runs financial or destructive, even if configured", () => {
    const cfg = config({ categoryPolicies: { ...config().categoryPolicies, financial: "auto", destructive: "auto" } });
    expect(decidePolicy(cfg, { category: "financial" }).decision).toBe("never");
    expect(decidePolicy(cfg, { category: "destructive" }).decision).toBe("never");
  });

  it("forces approval on low-confidence non-trivial actions", () => {
    const r = decidePolicy(config(), { category: "sales_reply", confidence: 0.3 });
    expect(r.decision).toBe("approval");
  });

  it("requires approval for bulk communication regardless of category policy", () => {
    const r = decidePolicy(config(), { category: "sales_reply", confidence: 0.99, recipientCount: 150 });
    expect(r.decision).toBe("approval");
    expect(r.reason).toContain("150");
  });

  it("kill switch queues external actions for approval", () => {
    const r = decidePolicy(config({ paused: true }), { category: "sales_reply", confidence: 0.99 });
    expect(r.decision).toBe("approval");
  });

  it("assist level never auto-sends external actions", () => {
    const r = decidePolicy(config({ level: "assist" }), { category: "sales_reply", confidence: 0.99 });
    expect(r.decision).toBe("approval");
  });

  it("prepares (not sends) auto replies outside business hours below autopilot", () => {
    const cfg = config({ level: "prepare", categoryPolicies: { ...config().categoryPolicies }, businessHours: { timezone: "UTC", days: [1], start: "09:00", end: "10:00" } });
    // Pick a Sunday (day 0) which is outside configured days.
    const sunday = new Date("2026-08-16T12:00:00Z");
    const r = decidePolicy(cfg, { category: "sales_reply", confidence: 0.99 }, sunday);
    expect(r.decision).toBe("approval");
  });

  it("withinBusinessHours respects days and window", () => {
    const hours = { timezone: "UTC", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" };
    expect(withinBusinessHours(hours, new Date("2026-08-17T10:00:00Z"))).toBe(true); // Mon 10:00
    expect(withinBusinessHours(hours, new Date("2026-08-17T18:00:00Z"))).toBe(false); // Mon 18:00
    expect(withinBusinessHours(hours, new Date("2026-08-16T10:00:00Z"))).toBe(false); // Sun
  });
});
