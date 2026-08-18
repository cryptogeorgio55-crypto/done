import { z } from "zod";
import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { ai } from "@/lib/ai/service";
import { wrapUntrusted } from "@/lib/ai/untrusted";

/**
 * DECISION ROOM
 *
 * Where a business decision — "Should I discount this client?", "Which leads
 * should we focus on?" — is analyzed, not just answered. We assemble the
 * relevant business context (brain, products, policies, operating rules, leads)
 * and ask the reasoning model for a grounded recommendation with evidence,
 * alternatives and risks. It never exposes chain-of-thought; only a useful,
 * observable rationale.
 */

export const DecisionSchema = z.object({
  decision: z.string(), // the headline recommendation, e.g. "Don't discount yet."
  confidence: z.enum(["low", "medium", "high"]),
  why: z.string(), // short, observable rationale
  betterMove: z.string().nullish(), // a stronger alternative to the naive action
  alternatives: z
    .array(
      z.object({
        label: z.string(),
        impact: z.enum(["low", "medium", "high"]),
        effort: z.enum(["low", "medium", "high"]),
        risk: z.enum(["low", "medium", "high"]),
        note: z.string().nullish(),
      })
    )
    .default([]),
  risks: z.array(z.string()).default([]),
  nextAction: z.string(),
  // When the model genuinely lacks information, it says so instead of guessing.
  needsInfo: z.array(z.string()).default([]),
});

export type Decision = z.infer<typeof DecisionSchema>;

export interface DecisionResult {
  decision: Decision;
  provider: string;
  offline: boolean;
}

/** Assemble a focused context package from real business records. */
async function buildContext(ctx: WorkspaceContext): Promise<string> {
  const wsId = ctx.workspace.id;
  const [profile, products, policies, rules, leadStages] = await Promise.all([
    db.businessProfile.findUnique({ where: { workspaceId: wsId } }),
    db.productService.findMany({ where: { workspaceId: wsId, deletedAt: null }, take: 12 }),
    db.businessPolicy.findMany({ where: { workspaceId: wsId }, take: 12 }),
    db.operatingRule.findMany({ where: { workspaceId: wsId, active: true }, take: 20 }),
    db.lead.groupBy({ by: ["stage"], where: { workspaceId: wsId, deletedAt: null }, _count: true }),
  ]);

  const lines: string[] = [];
  if (profile) lines.push(`Business: ${profile.businessName}${profile.description ? ` — ${profile.description}` : ""}`);
  if (products.length)
    lines.push(
      "Products/services:\n" +
        products.map((p) => `- ${p.name}${p.price ? ` (${p.price})` : ""}${p.description ? `: ${p.description}` : ""}`).join("\n")
    );
  if (policies.length)
    lines.push("Policies:\n" + policies.map((p) => `- ${p.kind}: ${p.content}`).join("\n"));
  if (rules.length) lines.push("Owner operating rules:\n" + rules.map((r) => `- ${r.rule}`).join("\n"));
  if (leadStages.length)
    lines.push("Leads by stage: " + leadStages.map((s) => `${s.stage}=${s._count}`).join(", "));

  return lines.length ? lines.join("\n\n") : "No business context has been captured yet.";
}

const SYSTEM = `You are the Decision Room inside an intelligent business operating system.
The owner brings you a real business decision. Analyze it using ONLY the business
context provided. Recommend one concrete decision, explain why in plain observable
terms (never invent facts or numbers), offer 1-3 alternatives with impact/effort/risk,
list genuine risks, and give the single best next action.
If the context is missing information you'd need to decide well, populate "needsInfo"
with the specific questions instead of guessing. Do not reveal step-by-step reasoning.`;

/** Deterministic offline fallback — honest, never fabricated confidence. */
function offlineDecision(question: string, hasContext: boolean): Decision {
  return {
    decision: "Gather a little more context before committing.",
    confidence: "low",
    why: hasContext
      ? "Full analysis needs the reasoning model, which isn't configured right now. Based on the captured context, avoid an irreversible choice until you confirm the customer's real objection."
      : "There isn't enough business context captured yet to analyze this well.",
    betterMove: "Ask one clarifying question that reveals the real constraint (price, timing, or trust).",
    alternatives: [
      { label: "Do nothing yet", impact: "low", effort: "low", risk: "low", note: "Preserves optionality." },
      { label: "Make a small, reversible concession", impact: "medium", effort: "low", risk: "medium", note: "Test the objection." },
    ],
    risks: ["Deciding without confirming the customer's real concern."],
    nextAction: `Clarify the underlying constraint behind: "${question.slice(0, 120)}"`,
    needsInfo: hasContext ? [] : ["Add your products, pricing and key policies to the Business Brain."],
  };
}

/** Analyze an owner's business decision and return a structured recommendation. */
export async function analyzeDecision(ctx: WorkspaceContext, question: string): Promise<DecisionResult> {
  const context = await buildContext(ctx);
  const hasContext = !context.startsWith("No business context");

  const res = await ai.reason({
    system: SYSTEM,
    // The owner's question is trusted; business context is wrapped as data.
    prompt:
      `Decision to analyze: ${question}\n\n` +
      `${wrapUntrusted("BUSINESS CONTEXT", context)}`,
    schema: DecisionSchema,
    offline: () => offlineDecision(question, hasContext),
  });

  return { decision: res.data, provider: res.provider, offline: res.offline };
}
