import { db } from "@/lib/db";
import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { audit } from "@/lib/audit";

const brainSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().default(""),
  location: z.string().trim().max(160).optional().default(""),
  website: z.string().trim().max(200).optional().default(""),
  instagram: z.string().trim().max(120).optional().default(""),
  tone: z.string().trim().max(120).optional().default(""),
  idealCustomer: z.string().trim().max(600).optional().default(""),
  products: z.string().trim().max(2000).optional().default(""),
});

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const wsId = ctx.workspace.id;
  const [profile, brand, products, persona] = await Promise.all([
    db.businessProfile.findUnique({ where: { workspaceId: wsId } }),
    db.brandProfile.findUnique({ where: { workspaceId: wsId } }),
    db.productService.findMany({ where: { workspaceId: wsId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
    db.customerPersona.findFirst({ where: { workspaceId: wsId } }),
  ]);
  return ok({
    businessName: profile?.businessName || ctx.workspace.name,
    description: profile?.description || "",
    location: profile?.location || "",
    website: profile?.website || "",
    instagram: profile?.instagram || "",
    tone: brand?.toneOfVoice || "",
    idealCustomer: persona?.painPoints || "",
    products: products.map((p) => p.name).join("\n"),
  });
});

export const PUT = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const input = brainSchema.parse(await req.json().catch(() => ({})));
  const wsId = ctx.workspace.id;

  await db.$transaction(async (tx) => {
    await tx.businessProfile.upsert({
      where: { workspaceId: wsId },
      create: {
        workspaceId: wsId,
        businessName: input.businessName,
        description: input.description,
        location: input.location,
        website: input.website,
        instagram: input.instagram,
      },
      update: {
        businessName: input.businessName,
        description: input.description,
        location: input.location,
        website: input.website,
        instagram: input.instagram,
      },
    });
    await tx.brandProfile.upsert({
      where: { workspaceId: wsId },
      create: { workspaceId: wsId, toneOfVoice: input.tone },
      update: { toneOfVoice: input.tone },
    });
    if (input.idealCustomer) {
      const existing = await tx.customerPersona.findFirst({ where: { workspaceId: wsId } });
      if (existing) {
        await tx.customerPersona.update({
          where: { id: existing.id },
          data: { label: input.idealCustomer.slice(0, 120), painPoints: input.idealCustomer },
        });
      } else {
        await tx.customerPersona.create({
          data: { workspaceId: wsId, label: input.idealCustomer.slice(0, 120), painPoints: input.idealCustomer },
        });
      }
    }
    const names = input.products.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
    await tx.productService.deleteMany({ where: { workspaceId: wsId } });
    if (names.length) {
      await tx.productService.createMany({ data: names.map((name) => ({ workspaceId: wsId, name })) });
    }
    await tx.workspace.update({ where: { id: wsId }, data: { name: input.businessName } });
  });

  await audit({ action: "brain.updated", actorId: ctx.user.id, workspaceId: wsId });
  return ok({ saved: true });
});
