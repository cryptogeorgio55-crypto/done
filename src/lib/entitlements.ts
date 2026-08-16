import { db } from "@/lib/db";
import { EntitlementError } from "@/lib/errors";

/** The shape of what a plan grants. Unlimited is represented by null. */
export interface Entitlements {
  aiGenerationsPerMonth: number | null;
  lazyRunsPerMonth: number | null;
  leads: number | null;
  teamMembers: number | null;
  contentHistory: number | null;
  advancedAnalytics: boolean;
}

/** Fallback used when no subscription/plan exists yet (e.g. brand-new trial). */
export const DEFAULT_FREE_ENTITLEMENTS: Entitlements = {
  aiGenerationsPerMonth: 30,
  lazyRunsPerMonth: 15,
  leads: 50,
  teamMembers: 1,
  contentHistory: 100,
  advancedAnalytics: false,
};

function coerce(raw: unknown): Entitlements {
  const e = (raw ?? {}) as Partial<Entitlements>;
  return {
    aiGenerationsPerMonth:
      e.aiGenerationsPerMonth === undefined
        ? DEFAULT_FREE_ENTITLEMENTS.aiGenerationsPerMonth
        : e.aiGenerationsPerMonth,
    lazyRunsPerMonth:
      e.lazyRunsPerMonth === undefined
        ? DEFAULT_FREE_ENTITLEMENTS.lazyRunsPerMonth
        : e.lazyRunsPerMonth,
    leads: e.leads === undefined ? DEFAULT_FREE_ENTITLEMENTS.leads : e.leads,
    teamMembers:
      e.teamMembers === undefined ? DEFAULT_FREE_ENTITLEMENTS.teamMembers : e.teamMembers,
    contentHistory:
      e.contentHistory === undefined ? DEFAULT_FREE_ENTITLEMENTS.contentHistory : e.contentHistory,
    advancedAnalytics: Boolean(e.advancedAnalytics),
  };
}

/** Resolve the effective entitlements for a workspace from its subscription. */
export async function getEntitlements(workspaceId: string): Promise<Entitlements> {
  const sub = await db.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });

  // Only active/trialing subscriptions grant paid entitlements.
  if (sub && (sub.status === "active" || sub.status === "trialing") && sub.plan) {
    return coerce(sub.plan.entitlements);
  }
  return DEFAULT_FREE_ENTITLEMENTS;
}

/**
 * Throw an EntitlementError if consuming one more of `metric` would exceed the
 * plan limit. `currentCount` is the authoritative server-side usage count.
 */
export function assertWithinLimit(
  limit: number | null,
  currentCount: number,
  label: string
): void {
  if (limit === null) return; // unlimited
  if (currentCount >= limit) {
    throw new EntitlementError(
      `You've used all ${limit} ${label} on your current plan this month. Upgrade to continue.`
    );
  }
}
