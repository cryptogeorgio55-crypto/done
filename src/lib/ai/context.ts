import { db } from "@/lib/db";
import { getIndustry } from "@/lib/industries";

/**
 * Structured, size-bounded snapshot of a workspace's Business Brain plus a
 * little recent history. This is what every generation is grounded in — it is
 * deliberately NOT the entire database, to keep prompts focused and cheap.
 */
export interface BusinessContext {
  businessName: string;
  industryKey?: string | null;
  industryLabel?: string;
  industryGuidance?: string;
  description?: string | null;
  location?: string | null;
  website?: string | null;
  instagram?: string | null;
  tone?: string | null;
  personality?: string | null;
  wordsToAvoid?: string | null;
  usps?: string | null;
  products: { name: string; price?: string | null; description?: string | null }[];
  personas: { label: string; painPoints?: string | null; motivations?: string | null }[];
  goals: string[];
  policies: { kind: string; content: string }[];
  recentContentTitles: string[];
  recentCampaignTitles: string[];
}

export async function buildBusinessContext(workspaceId: string): Promise<BusinessContext> {
  const [profile, brand, products, personas, goals, policies, recentContent, recentCampaigns] =
    await Promise.all([
      db.businessProfile.findUnique({ where: { workspaceId } }),
      db.brandProfile.findUnique({ where: { workspaceId } }),
      db.productService.findMany({
        where: { workspaceId, deletedAt: null },
        take: 8,
        orderBy: { createdAt: "asc" },
      }),
      db.customerPersona.findMany({ where: { workspaceId }, take: 4 }),
      db.businessGoal.findMany({ where: { workspaceId }, orderBy: { priority: "desc" }, take: 6 }),
      db.businessPolicy.findMany({ where: { workspaceId }, take: 8 }),
      db.contentItem.findMany({
        where: { workspaceId, deletedAt: null },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: { title: true, type: true },
      }),
      db.campaign.findMany({
        where: { workspaceId, deletedAt: null },
        take: 6,
        orderBy: { createdAt: "desc" },
        select: { title: true },
      }),
    ]);

  const industry = getIndustry(profile?.industryKey);

  return {
    businessName: profile?.businessName || "the business",
    industryKey: profile?.industryKey,
    industryLabel: industry?.label,
    industryGuidance: industry?.aiGuidance,
    description: profile?.description,
    location: profile?.location,
    website: profile?.website,
    instagram: profile?.instagram,
    tone: brand?.toneOfVoice,
    personality: brand?.personality,
    wordsToAvoid: brand?.wordsToAvoid,
    usps: brand?.usps,
    products: products.map((p) => ({ name: p.name, price: p.price, description: p.description })),
    personas: personas.map((p) => ({
      label: p.label,
      painPoints: p.painPoints,
      motivations: p.motivations,
    })),
    goals: goals.map((g) => g.label),
    policies: policies.map((p) => ({ kind: p.kind, content: p.content })),
    recentContentTitles: recentContent.map((c) => c.title || c.type).filter(Boolean),
    recentCampaignTitles: recentCampaigns.map((c) => c.title),
  };
}

/** Render context as a compact text block for LLM prompts. */
export function renderContext(ctx: BusinessContext): string {
  const lines: string[] = [];
  lines.push(`Business: ${ctx.businessName}`);
  if (ctx.industryLabel) lines.push(`Industry: ${ctx.industryLabel}`);
  if (ctx.description) lines.push(`About: ${ctx.description}`);
  if (ctx.location) lines.push(`Location: ${ctx.location}`);
  if (ctx.tone) lines.push(`Tone of voice: ${ctx.tone}`);
  if (ctx.personality) lines.push(`Brand personality: ${ctx.personality}`);
  if (ctx.usps) lines.push(`Unique selling points: ${ctx.usps}`);
  if (ctx.wordsToAvoid) lines.push(`Words to AVOID: ${ctx.wordsToAvoid}`);
  if (ctx.products.length) {
    lines.push(
      "Products/services: " +
        ctx.products
          .map((p) => `${p.name}${p.price ? ` (${p.price})` : ""}`)
          .join("; ")
    );
  }
  if (ctx.personas.length) {
    lines.push(
      "Ideal customers: " +
        ctx.personas
          .map((p) => `${p.label}${p.painPoints ? ` — pains: ${p.painPoints}` : ""}`)
          .join("; ")
    );
  }
  if (ctx.goals.length) lines.push(`Goals: ${ctx.goals.join(", ")}`);
  if (ctx.policies.length) {
    lines.push("Policies: " + ctx.policies.map((p) => `${p.kind}: ${p.content}`).join("; "));
  }
  if (ctx.recentCampaignTitles.length) {
    lines.push(`Recent campaigns (avoid repeating): ${ctx.recentCampaignTitles.join(", ")}`);
  }
  if (ctx.recentContentTitles.length) {
    lines.push(`Recent content (avoid repeating): ${ctx.recentContentTitles.join(", ")}`);
  }
  if (ctx.industryGuidance) lines.push(`Industry guidance: ${ctx.industryGuidance}`);
  return lines.join("\n");
}
