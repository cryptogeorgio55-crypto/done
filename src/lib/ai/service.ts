import type { z } from "zod";
import { generateJSON, type AiTier, type GenerateJsonResult } from "./provider";

/**
 * AIService — the single capability facade the product calls.
 *
 *   ai.classify / ai.extract / ai.summarize   → FAST   (cheap, high-volume)
 *   ai.generate / ai.reply                     → PRIMARY (customer-facing text)
 *   ai.reason   / ai.plan                      → REASONING (Next Move, Decision Room, planning)
 *
 * Call sites ask for a *capability*, never a model name or a provider. The tier
 * → model mapping lives in provider.ts (DeepSeek today), so we can change model,
 * change provider, or self-host later without touching any product code.
 */
type Task<S extends z.ZodTypeAny> = {
  system: string;
  prompt: string;
  schema: S;
  offline: () => z.infer<S>;
};

function at<S extends z.ZodTypeAny>(tier: AiTier, t: Task<S>): Promise<GenerateJsonResult<z.infer<S>>> {
  return generateJSON({ ...t, tier });
}

export const ai = {
  /** Fast, high-volume understanding: intent, sentiment, spam, tagging, routing. */
  classify: <S extends z.ZodTypeAny>(t: Task<S>) => at("fast", t),
  /** Fast structured extraction from a document/message. */
  extract: <S extends z.ZodTypeAny>(t: Task<S>) => at("fast", t),
  /** Fast summarization. */
  summarize: <S extends z.ZodTypeAny>(t: Task<S>) => at("fast", t),
  /** Customer-facing generation: content, campaigns, copy. */
  generate: <S extends z.ZodTypeAny>(t: Task<S>) => at("primary", t),
  /** Customer-facing reply drafting. */
  reply: <S extends z.ZodTypeAny>(t: Task<S>) => at("primary", t),
  /** Deep reasoning: Next Move ranking, Decision Room, opportunity detection. */
  reason: <S extends z.ZodTypeAny>(t: Task<S>) => at("reasoning", t),
  /** Multi-step planning: execution plans, cross-app workflows. */
  plan: <S extends z.ZodTypeAny>(t: Task<S>) => at("reasoning", t),
} as const;

export type { AiTier } from "./provider";
