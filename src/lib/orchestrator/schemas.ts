import { z } from "zod";

// Structured, validated schemas for every AI decision in the DONE Loop. We never
// parse free prose to drive production actions — malformed output is rejected.

export const emailClassification = z.object({
  intent: z.enum([
    "sales_inquiry",
    "existing_customer",
    "complaint",
    "support_question",
    "scheduling",
    "financial",
    "spam",
    "other",
  ]),
  urgency: z.enum(["low", "normal", "high"]),
  confidence: z.number().min(0).max(1),
  isLead: z.boolean().default(false),
  personName: z.string().max(120).default(""),
  summary: z.string().max(400),
  // A safe, one-line rationale — never raw chain-of-thought.
  reasonSummary: z.string().max(300).default(""),
});
export type EmailClassification = z.infer<typeof emailClassification>;

/** One proposed action in a plan. `tool` must be one of the registered tools. */
export const plannedAction = z.object({
  tool: z.string().max(60),
  input: z.record(z.string(), z.unknown()),
  reason: z.string().max(300).default(""),
});
export type PlannedAction = z.infer<typeof plannedAction>;

export const actionPlan = z.object({
  intent: z.string().max(120),
  summary: z.string().max(400),
  message: z.string().max(300), // friendly owner-facing line
  actions: z.array(plannedAction).max(6),
});
export type ActionPlan = z.infer<typeof actionPlan>;

/** The reply-drafting step returns a validated message body. */
export const draftedReply = z.object({
  subject: z.string().max(300),
  body: z.string().min(1).max(6000),
  usedKnowledge: z.boolean().default(false),
  missingKnowledge: z.string().max(300).default(""),
});
export type DraftedReply = z.infer<typeof draftedReply>;
