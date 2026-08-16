import { z } from "zod";

// Every AI response is validated against one of these schemas. We never parse
// arbitrary free text where structured output is expected.

export const AssetKind = z.enum([
  "instagram_post",
  "caption",
  "story",
  "reel",
  "whatsapp",
  "sales_message",
  "followup",
  "cta",
  "ad",
  "checklist",
]);
export type AssetKind = z.infer<typeof AssetKind>;

export const campaignSchema = z.object({
  title: z.string().min(2).max(120),
  objective: z.string().min(2).max(400),
  audience: z.string().min(2).max(400),
  offer: z.string().max(400).optional().default(""),
  hook: z.string().max(400).optional().default(""),
  assets: z
    .array(
      z.object({
        kind: AssetKind,
        title: z.string().max(120).optional().default(""),
        body: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
});
export type CampaignOutput = z.infer<typeof campaignSchema>;

export const contentSchema = z.object({
  type: z.string().min(2).max(60),
  title: z.string().max(160).optional().default(""),
  body: z.string().min(1).max(6000),
  hashtags: z.array(z.string().max(60)).max(30).optional().default([]),
});
export type ContentOutput = z.infer<typeof contentSchema>;

export const replySchema = z.object({
  reply: z.string().min(1).max(4000),
  tone: z.string().max(40).optional().default(""),
  notes: z.string().max(600).optional().default(""),
});
export type ReplyOutput = z.infer<typeof replySchema>;

export const followUpSchema = z.object({
  message: z.string().min(1).max(3000),
  channel: z.string().max(40).optional().default(""),
  reasoning: z.string().max(600).optional().default(""),
});
export type FollowUpOutput = z.infer<typeof followUpSchema>;

export const weekPlanSchema = z.object({
  summary: z.string().min(2).max(600),
  days: z
    .array(
      z.object({
        day: z.string().max(20),
        focus: z.string().max(200),
        tasks: z.array(z.string().max(300)).max(10),
      })
    )
    .min(1)
    .max(7),
});
export type WeekPlanOutput = z.infer<typeof weekPlanSchema>;

/** The planner's decision behind I'M LAZY. Only safe summaries — no raw CoT. */
export const lazyPlanSchema = z.object({
  objective: z.string().min(2).max(200),
  reasoningSummary: z.string().min(2).max(600),
  recommendedAction: z.enum([
    "campaign",
    "content",
    "offer",
    "week_plan",
    "followup",
  ]),
  priority: z.enum(["low", "medium", "high"]),
  audience: z.string().max(300).optional().default(""),
  message: z.string().min(2).max(400), // the friendly "I noticed..." line
  executionSteps: z.array(z.string().max(300)).max(10).optional().default([]),
});
export type LazyPlan = z.infer<typeof lazyPlanSchema>;

export const AI_SCHEMAS = {
  campaign: campaignSchema,
  content: contentSchema,
  reply: replySchema,
  followup: followUpSchema,
  week_plan: weekPlanSchema,
  lazy_plan: lazyPlanSchema,
} as const;
