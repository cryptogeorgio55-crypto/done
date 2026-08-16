import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { buildBusinessContext, renderContext } from "./context";
import { generateJSON } from "./provider";
import { lazyPlanSchema, type LazyPlan } from "./schemas";
import { offlineLazyPlan } from "./offline";
import { generateCampaign, generateContent, generateWeekPlan, generateFollowUp } from "./generate";
import { getEntitlements, assertWithinLimit } from "@/lib/entitlements";
import { getUsageCount, incrementUsage } from "@/lib/usage";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface LazyResult {
  runId: string;
  message: string;
  plan: LazyPlan;
  resultKind: string;
  campaignId?: string;
  contentId?: string;
  offline: boolean;
}

/**
 * The full I'M LAZY workflow:
 * entitlement/usage guard → context → planner → structured validation →
 * execution of the chosen generator → persistence → LazyRun state →
 * usage record → notification. Idempotent per idempotencyKey.
 */
export async function runLazy(
  ctx: WorkspaceContext,
  opts: { idempotencyKey?: string } = {}
): Promise<LazyResult> {
  // Idempotency: return the existing run if this key already completed.
  if (opts.idempotencyKey) {
    const existing = await db.lazyRun.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: ctx.workspace.id,
          idempotencyKey: opts.idempotencyKey,
        },
      },
    });
    if (existing && existing.status === "completed") {
      return {
        runId: existing.id,
        message: existing.message || "Here's what I prepared.",
        plan: (existing.plan as LazyPlan) ?? ({} as LazyPlan),
        resultKind: existing.resultKind || "campaign",
        campaignId: existing.campaignId || undefined,
        offline: false,
      };
    }
  }

  // Entitlement guard for Lazy runs.
  const ent = await getEntitlements(ctx.workspace.id);
  const used = await getUsageCount(ctx.workspace.id, "lazy_run");
  assertWithinLimit(ent.lazyRunsPerMonth, used, "I'M LAZY runs");

  const bctx = await buildBusinessContext(ctx.workspace.id);
  const [campaignCount, contentCount] = await Promise.all([
    db.campaign.count({ where: { workspaceId: ctx.workspace.id, deletedAt: null } }),
    db.contentItem.count({ where: { workspaceId: ctx.workspace.id, deletedAt: null } }),
  ]);
  const dayName = DAY_NAMES[new Date().getUTCDay()];

  // 1. Plan.
  const planResult = await generateJSON({
    system: [
      "You are DONE's decision engine. Given a small business's context and recent activity,",
      "decide the single highest-value marketing action to take right now.",
      "Do NOT reveal step-by-step private reasoning — provide only a short, safe summary.",
      "",
      "BUSINESS CONTEXT:",
      renderContext(bctx),
      "",
      `Recent activity: ${campaignCount} campaigns, ${contentCount} content pieces. Today is ${dayName}.`,
      "Return JSON: { objective, reasoningSummary, recommendedAction, priority, audience, message, executionSteps: [] }.",
      "recommendedAction must be one of: campaign, content, offer, week_plan, followup.",
    ].join("\n"),
    prompt: "Decide the best next action and explain it in one friendly sentence for the owner.",
    schema: lazyPlanSchema,
    offline: () =>
      offlineLazyPlan(bctx, {
        hasCampaigns: campaignCount > 0,
        hasContent: contentCount > 0,
        dayName,
      }),
  });
  const plan = planResult.data;

  // 2. Create the run in "generating" state.
  const run = await db.lazyRun.create({
    data: {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      idempotencyKey: opts.idempotencyKey || null,
      status: "generating",
      plan,
      resultKind: plan.recommendedAction,
      message: plan.message,
    },
  });

  // 3. Execute the chosen action.
  let campaignId: string | undefined;
  let contentId: string | undefined;
  let resultKind = plan.recommendedAction;
  try {
    if (plan.recommendedAction === "campaign" || plan.recommendedAction === "offer") {
      const { campaign } = await generateCampaign(ctx, {
        objective: plan.objective,
        source: "lazy",
      });
      campaignId = campaign.id;
      resultKind = "campaign";
    } else if (plan.recommendedAction === "week_plan") {
      await generateWeekPlan(ctx);
      resultKind = "week_plan";
    } else if (plan.recommendedAction === "followup") {
      const lead = await db.lead.findFirst({
        where: { workspaceId: ctx.workspace.id, deletedAt: null, stage: { notIn: ["won", "lost"] } },
        orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "asc" }],
      });
      if (lead) {
        await generateFollowUp(ctx, { leadId: lead.id });
        resultKind = "followup";
      } else {
        const { item } = await generateContent(ctx, { type: "instagram_post" });
        contentId = item.id;
        resultKind = "content";
      }
    } else {
      const { item } = await generateContent(ctx, { type: "instagram_post" });
      contentId = item.id;
      resultKind = "content";
    }
  } catch (err) {
    await db.lazyRun.update({ where: { id: run.id }, data: { status: "failed" } });
    throw err;
  }

  // 4. Complete the run.
  await db.lazyRun.update({
    where: { id: run.id },
    data: { status: "completed", completedAt: new Date(), resultKind, campaignId: campaignId || null },
  });

  // 5. Usage + notification.
  await incrementUsage(ctx.workspace.id, "lazy_run");
  await db.notification.create({
    data: {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      kind: "lazy_completed",
      title: "DONE ✓",
      body: plan.message,
    },
  });

  return {
    runId: run.id,
    message: plan.message,
    plan,
    resultKind,
    campaignId,
    contentId,
    offline: planResult.offline,
  };
}
