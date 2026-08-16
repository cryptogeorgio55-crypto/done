import { describe, it, expect } from "vitest";
import { offlineCampaign, offlineLazyPlan } from "./offline";
import { campaignSchema, lazyPlanSchema } from "./schemas";
import type { BusinessContext } from "./context";

const ctx: BusinessContext = {
  businessName: "Glow Beauty Studio",
  industryKey: "beauty_salon",
  industryLabel: "Beauty Salon",
  description: "A nail salon.",
  location: "Manchester",
  products: [{ name: "Gel manicure", price: "£25" }],
  personas: [{ label: "Women 25-45" }],
  goals: ["Get more bookings"],
  policies: [],
  recentContentTitles: [],
  recentCampaignTitles: [],
};

describe("offline campaign generation", () => {
  it("produces schema-valid, business-specific output", () => {
    const out = offlineCampaign(ctx);
    const parsed = campaignSchema.parse(out); // throws if invalid
    expect(parsed.title).toContain("Glow Beauty Studio");
    expect(parsed.assets.length).toBeGreaterThanOrEqual(1);
    expect(parsed.assets.some((a) => a.body.includes("Gel manicure"))).toBe(true);
  });
});

describe("lazy planner decisions", () => {
  it("recommends a campaign when none exist yet", () => {
    const plan = offlineLazyPlan(ctx, { hasCampaigns: false, hasContent: false, dayName: "Tue" });
    lazyPlanSchema.parse(plan);
    expect(plan.recommendedAction).toBe("campaign");
    expect(plan.priority).toBe("high");
  });

  it("recommends a weekend campaign on Friday when campaigns already exist", () => {
    const plan = offlineLazyPlan(ctx, { hasCampaigns: true, hasContent: true, dayName: "Fri" });
    lazyPlanSchema.parse(plan);
    expect(plan.recommendedAction).toBe("campaign");
    expect(plan.message.toLowerCase()).toContain("weekend");
  });

  it("falls back to content when there are no products", () => {
    const bare = { ...ctx, products: [] };
    const plan = offlineLazyPlan(bare, { hasCampaigns: false, hasContent: false, dayName: "Tue" });
    lazyPlanSchema.parse(plan);
    expect(plan.recommendedAction).toBe("content");
  });
});
