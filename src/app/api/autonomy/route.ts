import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { audit } from "@/lib/audit";
import { getAutonomyConfig, updateAutonomyConfig, setPaused } from "@/lib/autonomy/settings";

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const config = await getAutonomyConfig(ctx.workspace.id);
  return ok({ config });
});

const decision = z.enum(["auto", "approval", "never", "ignore"]);
const putSchema = z.object({
  level: z.enum(["shadow", "assist", "prepare", "autopilot", "custom"]).optional(),
  paused: z.boolean().optional(),
  pausedReason: z.string().max(200).nullable().optional(),
  categoryPolicies: z.record(z.string(), decision).optional(),
  businessHours: z.object({
    timezone: z.string().max(60),
    days: z.array(z.number().int().min(0).max(6)),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  dailyActionLimit: z.number().int().min(1).max(1000).optional(),
  monthlyAiBudget: z.number().int().min(0).nullable().optional(),
  senderName: z.string().max(120).nullable().optional(),
  signature: z.string().max(600).nullable().optional(),
});

export const PUT = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const patch = putSchema.parse(await req.json().catch(() => ({})));
  const config = await updateAutonomyConfig(ctx.workspace.id, patch as Parameters<typeof updateAutonomyConfig>[1]);
  await audit({ action: "autonomy.updated", workspaceId: ctx.workspace.id, actorId: ctx.user.id, metadata: { level: config.level } });
  return ok({ config });
});

// Kill switch — pause/resume all autonomous external actions.
const pauseSchema = z.object({ paused: z.boolean(), reason: z.string().max(200).optional() });
export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const { paused, reason } = pauseSchema.parse(await req.json().catch(() => ({})));
  await setPaused(ctx.workspace.id, paused, reason);
  await audit({ action: paused ? "autopilot.paused" : "autopilot.resumed", workspaceId: ctx.workspace.id, actorId: ctx.user.id });
  return ok({ paused });
});
