import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(200);

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: z.string().min(8).max(200),
  businessName: z.string().trim().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  industryKey: z.string().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(160).optional(),
  website: z.string().trim().max(200).optional(),
  instagram: z.string().trim().max(120).optional(),
  products: z.string().trim().max(2000).optional(), // free text, split into items
  idealCustomer: z.string().trim().max(600).optional(),
  goal: z.string().max(60).optional(),
  tone: z.string().trim().max(120).optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const lazySchema = z.object({
  idempotencyKey: z.string().max(120).optional(),
});

export const contentSchema = z.object({
  type: z.string().min(2).max(60),
});

export const replyInputSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  mode: z
    .enum([
      "professional",
      "friendly",
      "short",
      "sales",
      "objection",
      "complaint",
      "price",
      "availability",
      "booking",
      "followup",
    ])
    .default("friendly"),
});

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(60).optional(),
  source: z.string().trim().max(120).optional(),
  stage: z.enum(["new", "contacted", "interested", "followup", "won", "lost"]).default("new"),
  notes: z.string().trim().max(2000).optional(),
  estimatedValue: z.string().trim().max(60).optional(),
});

export const campaignGenerateSchema = z.object({
  objective: z.string().trim().max(400).optional(),
});
