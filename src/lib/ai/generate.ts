import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { buildBusinessContext, renderContext, type BusinessContext } from "./context";
import { generateJSON } from "./provider";
import {
  campaignSchema,
  contentSchema,
  replySchema,
  followUpSchema,
  weekPlanSchema,
  type CampaignOutput,
} from "./schemas";
import {
  offlineCampaign,
  offlineContent,
  offlineReply,
  offlineFollowUp,
  offlineWeekPlan,
} from "./offline";
import { getEntitlements, assertWithinLimit } from "@/lib/entitlements";
import { getUsageCount, incrementUsage } from "@/lib/usage";
import { NotFoundError } from "@/lib/errors";

/** Base system prompt shared by all generators, grounded in the Business Brain. */
function baseSystem(bctx: BusinessContext): string {
  return [
    "You are DONE, an expert marketing and sales assistant for a small business.",
    "Write like a skilled human marketer: specific, warm, and on-brand. Avoid generic filler and obvious AI phrasing.",
    "Always ground everything in the business context below. Never invent prices, policies, or facts not provided.",
    "",
    "BUSINESS CONTEXT:",
    renderContext(bctx),
  ].join("\n");
}

/** Check the AI-generation entitlement BEFORE calling the provider. */
async function guardAiUsage(workspaceId: string) {
  const ent = await getEntitlements(workspaceId);
  const used = await getUsageCount(workspaceId, "ai_generation");
  assertWithinLimit(ent.aiGenerationsPerMonth, used, "AI generations");
}

// --- Campaign ---------------------------------------------------------------

export async function generateCampaign(
  ctx: WorkspaceContext,
  opts: { objective?: string; source?: string } = {}
) {
  await guardAiUsage(ctx.workspace.id);
  const bctx = await buildBusinessContext(ctx.workspace.id);
  const result = await generateJSON({
    system: baseSystem(bctx),
    prompt: [
      "Create a complete customer-acquisition campaign for this business.",
      opts.objective ? `Objective: ${opts.objective}.` : "Choose the highest-value objective yourself.",
      "Include a mix of assets (instagram_post, caption, story, reel, whatsapp, followup, cta, checklist).",
      "Return JSON: { title, objective, audience, offer, hook, assets: [{ kind, title, body }] }.",
    ].join("\n"),
    schema: campaignSchema,
    offline: () => offlineCampaign(bctx, opts.objective),
  });

  const data: CampaignOutput = result.data;
  const campaign = await db.$transaction(async (tx) => {
    const c = await tx.campaign.create({
      data: {
        workspaceId: ctx.workspace.id,
        title: data.title,
        objective: data.objective,
        audience: data.audience,
        offer: data.offer,
        summary: data.hook,
        status: "draft",
        source: opts.source || "manual",
        assets: {
          create: data.assets.map((a, i) => ({
            kind: a.kind,
            title: a.title || null,
            body: a.body,
            position: i,
          })),
        },
      },
      include: { assets: { orderBy: { position: "asc" } } },
    });
    await tx.aiGeneration.create({
      data: {
        workspaceId: ctx.workspace.id,
        userId: ctx.user.id,
        kind: "campaign",
        provider: result.provider,
        model: result.model,
        inputSummary: data.objective,
        output: data,
        campaignId: c.id,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      },
    });
    return c;
  });

  await incrementUsage(ctx.workspace.id, "ai_generation");
  await incrementUsage(ctx.workspace.id, "campaign");
  return { campaign, offline: result.offline };
}

// --- Content ----------------------------------------------------------------

export async function generateContent(ctx: WorkspaceContext, opts: { type: string }) {
  await guardAiUsage(ctx.workspace.id);
  const bctx = await buildBusinessContext(ctx.workspace.id);
  const result = await generateJSON({
    system: baseSystem(bctx),
    prompt: [
      `Create one piece of "${opts.type}" content for this business.`,
      "Make it specific to the business and ready to post. Avoid repeating recent content listed above.",
      "Return JSON: { type, title, body, hashtags: [] }.",
    ].join("\n"),
    schema: contentSchema,
    offline: () => offlineContent(bctx, opts.type),
  });

  const data = result.data;
  const item = await db.$transaction(async (tx) => {
    const c = await tx.contentItem.create({
      data: {
        workspaceId: ctx.workspace.id,
        type: opts.type,
        title: data.title || null,
        body: data.hashtags?.length ? `${data.body}\n\n${data.hashtags.join(" ")}` : data.body,
        status: "draft",
      },
    });
    await tx.aiGeneration.create({
      data: {
        workspaceId: ctx.workspace.id,
        userId: ctx.user.id,
        kind: "content",
        provider: result.provider,
        model: result.model,
        inputSummary: opts.type,
        output: data,
        contentItemId: c.id,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      },
    });
    return c;
  });

  await incrementUsage(ctx.workspace.id, "ai_generation");
  await incrementUsage(ctx.workspace.id, "content");
  return { item, offline: result.offline };
}

// --- Reply ------------------------------------------------------------------

export async function generateReply(
  ctx: WorkspaceContext,
  opts: { message: string; mode: string }
) {
  await guardAiUsage(ctx.workspace.id);
  const bctx = await buildBusinessContext(ctx.workspace.id);
  const result = await generateJSON({
    system: baseSystem(bctx),
    prompt: [
      `A customer sent this message:\n"""${opts.message}"""`,
      `Write a reply in a "${opts.mode}" style, using the business's tone, prices and policies where relevant.`,
      "Return JSON: { reply, tone, notes }.",
    ].join("\n"),
    schema: replySchema,
    offline: () => offlineReply(bctx, opts.message, opts.mode),
  });

  await db.aiGeneration.create({
    data: {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      kind: "reply",
      provider: result.provider,
      model: result.model,
      inputSummary: opts.message.slice(0, 200),
      output: result.data,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    },
  });
  await incrementUsage(ctx.workspace.id, "ai_generation");
  return { reply: result.data, offline: result.offline };
}

// --- Follow-up --------------------------------------------------------------

export async function generateFollowUp(
  ctx: WorkspaceContext,
  opts: { leadId: string; mode?: string }
) {
  await guardAiUsage(ctx.workspace.id);
  const lead = await db.lead.findFirst({
    where: { id: opts.leadId, workspaceId: ctx.workspace.id, deletedAt: null },
  });
  if (!lead) throw new NotFoundError("Lead not found.");

  const bctx = await buildBusinessContext(ctx.workspace.id);
  const result = await generateJSON({
    system: baseSystem(bctx),
    prompt: [
      `Write a follow-up message to a lead named "${lead.name}" at stage "${lead.stage}".`,
      lead.notes ? `Notes about this lead: ${lead.notes}` : "",
      "Keep it warm, personal and low-pressure. Return JSON: { message, channel, reasoning }.",
    ].join("\n"),
    schema: followUpSchema,
    offline: () => offlineFollowUp(bctx, lead, opts.mode),
  });

  await db.aiGeneration.create({
    data: {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      kind: "followup",
      provider: result.provider,
      model: result.model,
      inputSummary: `lead:${lead.id}`,
      output: result.data,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    },
  });
  await incrementUsage(ctx.workspace.id, "ai_generation");
  return { followUp: result.data, offline: result.offline };
}

// --- Weekly plan ------------------------------------------------------------

export async function generateWeekPlan(ctx: WorkspaceContext) {
  await guardAiUsage(ctx.workspace.id);
  const bctx = await buildBusinessContext(ctx.workspace.id);
  const result = await generateJSON({
    system: baseSystem(bctx),
    prompt: [
      "Create a practical, realistic 7-day marketing plan for this small business.",
      "Each day should have a focus and 1-3 concrete tasks. Keep it doable for a busy owner.",
      "Return JSON: { summary, days: [{ day, focus, tasks: [] }] }.",
    ].join("\n"),
    schema: weekPlanSchema,
    offline: () => offlineWeekPlan(bctx),
  });

  await db.aiGeneration.create({
    data: {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      kind: "plan",
      provider: result.provider,
      model: result.model,
      output: result.data,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    },
  });
  await incrementUsage(ctx.workspace.id, "ai_generation");
  return { plan: result.data, offline: result.offline };
}
