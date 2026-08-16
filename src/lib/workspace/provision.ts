import { db } from "@/lib/db";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";
}

/** Generate a workspace slug that is unique across the platform. */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  // Loop until we find a free slug. Bounded in practice.
  while (await db.workspace.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

/**
 * Create a workspace for a user and make them its owner. Attaches a trialing
 * subscription to the free plan when one exists. Runs in a transaction.
 */
export async function createWorkspaceForUser(userId: string, businessName: string) {
  const slug = await uniqueSlug(businessName);
  const freePlan = await db.plan.findUnique({ where: { key: "free" } });

  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: businessName,
        slug,
        ownerId: userId,
      },
    });
    await tx.membership.create({
      data: {
        userId,
        workspaceId: workspace.id,
        role: "owner",
        acceptedAt: new Date(),
      },
    });
    if (freePlan) {
      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          planId: freePlan.id,
          status: "trialing",
          billingInterval: "monthly",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return workspace;
  });
}
