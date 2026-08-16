import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // --- Plans -------------------------------------------------------------
  const plans = [
    {
      key: "free",
      name: "Free",
      priceMonthly: 0,
      priceYearly: 0,
      sortOrder: 0,
      entitlements: {
        aiGenerationsPerMonth: 30,
        lazyRunsPerMonth: 15,
        leads: 50,
        teamMembers: 1,
        contentHistory: 100,
        advancedAnalytics: false,
      },
    },
    {
      key: "starter",
      name: "Starter",
      priceMonthly: 1900,
      priceYearly: 19000,
      sortOrder: 1,
      entitlements: {
        aiGenerationsPerMonth: 300,
        lazyRunsPerMonth: 150,
        leads: 1000,
        teamMembers: 3,
        contentHistory: 1000,
        advancedAnalytics: true,
      },
    },
    {
      key: "pro",
      name: "Pro",
      priceMonthly: 4900,
      priceYearly: 49000,
      sortOrder: 2,
      entitlements: {
        aiGenerationsPerMonth: null,
        lazyRunsPerMonth: null,
        leads: null,
        teamMembers: 10,
        contentHistory: null,
        advancedAnalytics: true,
      },
    },
  ];

  for (const p of plans) {
    await db.plan.upsert({
      where: { key: p.key },
      create: p,
      update: {
        name: p.name,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        sortOrder: p.sortOrder,
        entitlements: p.entitlements,
      },
    });
  }

  // --- Feature flags -----------------------------------------------------
  const flags = [
    { key: "social_publishing", description: "Publish posts to social platforms", enabled: false },
    { key: "team_invites", description: "Invite teammates to a workspace", enabled: true },
    { key: "billing", description: "Stripe billing & upgrades", enabled: false },
  ];
  for (const f of flags) {
    await db.featureFlag.upsert({
      where: { key: f.key },
      create: f,
      update: { description: f.description },
    });
  }

  console.log("Seed complete: plans and feature flags are ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
