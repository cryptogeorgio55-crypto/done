import { db } from "@/lib/db";
import { handle, ok } from "@/lib/http";
import { onboardingSchema } from "@/lib/validation";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { getIndustry } from "@/lib/industries";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const input = onboardingSchema.parse(await req.json().catch(() => ({})));
  const workspaceId = ctx.workspace.id;

  const industry = getIndustry(input.industryKey);

  await db.$transaction(async (tx) => {
    // Business profile (one per workspace).
    await tx.businessProfile.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        businessName: input.businessName,
        industryKey: input.industryKey,
        description: input.description,
        location: input.location,
        website: input.website,
        instagram: input.instagram,
      },
      update: {
        businessName: input.businessName,
        industryKey: input.industryKey,
        description: input.description,
        location: input.location,
        website: input.website,
        instagram: input.instagram,
      },
    });

    // Brand tone.
    if (input.tone) {
      await tx.brandProfile.upsert({
        where: { workspaceId },
        create: { workspaceId, toneOfVoice: input.tone },
        update: { toneOfVoice: input.tone },
      });
    }

    // Products from free text (one per line / comma).
    if (input.products) {
      const names = input.products
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      // Replace existing onboarding products to keep idempotent re-submits clean.
      await tx.productService.deleteMany({ where: { workspaceId } });
      if (names.length) {
        await tx.productService.createMany({
          data: names.map((name) => ({ workspaceId, name })),
        });
      }
    }

    // Ideal customer persona.
    if (input.idealCustomer) {
      const existing = await tx.customerPersona.findFirst({ where: { workspaceId } });
      if (existing) {
        await tx.customerPersona.update({
          where: { id: existing.id },
          data: { label: input.idealCustomer.slice(0, 120), painPoints: input.idealCustomer },
        });
      } else {
        await tx.customerPersona.create({
          data: { workspaceId, label: input.idealCustomer.slice(0, 120), painPoints: input.idealCustomer },
        });
      }
    }

    // Primary goal (+ industry default goals).
    const goalKeys = new Set<string>();
    if (input.goal) goalKeys.add(input.goal);
    industry?.defaultGoals.forEach((g) => goalKeys.add(g));
    if (goalKeys.size) {
      await tx.businessGoal.deleteMany({ where: { workspaceId } });
      await tx.businessGoal.createMany({
        data: [...goalKeys].map((key, i) => ({
          workspaceId,
          key,
          label: GOAL_LABELS[key] || key,
          priority: input.goal === key ? 10 : 5 - i,
        })),
      });
    }

    // Mark workspace onboarded.
    await tx.workspace.update({
      where: { id: workspaceId },
      data: {
        name: input.businessName,
        industryKey: input.industryKey,
        onboardedAt: new Date(),
      },
    });
  });

  await audit({ action: "workspace.onboarded", actorId: ctx.user.id, workspaceId });
  return ok({ redirect: "/dashboard" });
});

const GOAL_LABELS: Record<string, string> = {
  bookings: "Get more bookings",
  sales: "Sell more products",
  awareness: "Build awareness",
  repeat: "Increase repeat customers",
  leads: "Generate leads",
  engagement: "Increase social engagement",
};
