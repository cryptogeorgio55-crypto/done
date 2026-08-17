import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type {
  AutonomyConfig,
  AutonomyLevel,
  ActionCategory,
  PolicyDecision,
  BusinessHours,
} from "./types";

const DEFAULT_HOURS: BusinessHours = {
  timezone: "UTC",
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "18:00",
};

/**
 * Category defaults per autonomy level. "custom" starts from "prepare" and the
 * owner overrides individual categories. Destructive/financial are never auto
 * regardless of level — that guarantee lives in policy.ts, not here.
 */
function levelDefaults(level: AutonomyLevel): Partial<Record<ActionCategory, PolicyDecision>> {
  switch (level) {
    case "assist":
      // Assist never takes external action; everything external needs approval.
      return {
        sales_reply: "approval", customer_reply: "approval", complaint: "approval",
        schedule_meeting: "approval", send_quotation: "approval", send_followup: "approval",
        financial: "never", bulk_communication: "approval", destructive: "never",
        create_lead: "auto", update_lead: "auto", internal_task: "auto",
      };
    case "autopilot":
      return {
        sales_reply: "auto", customer_reply: "auto", schedule_meeting: "auto",
        send_followup: "auto", create_lead: "auto", update_lead: "auto", internal_task: "auto",
        complaint: "approval", send_quotation: "approval",
        financial: "never", bulk_communication: "approval", destructive: "never",
      };
    case "prepare":
    case "custom":
    default:
      return {
        sales_reply: "approval", customer_reply: "approval", complaint: "approval",
        schedule_meeting: "approval", send_quotation: "approval", send_followup: "approval",
        create_lead: "auto", update_lead: "auto", internal_task: "auto",
        financial: "never", bulk_communication: "approval", destructive: "never",
      };
  }
}

/** Resolve the effective autonomy config for a workspace (creating defaults). */
export async function getAutonomyConfig(workspaceId: string): Promise<AutonomyConfig> {
  const row = await db.autonomySettings.findUnique({ where: { workspaceId } });
  const level = (row?.level as AutonomyLevel) ?? "prepare";
  const defaults = levelDefaults(level);
  const stored = (row?.categoryPolicies as Partial<Record<ActionCategory, PolicyDecision>>) ?? {};
  return {
    level,
    paused: row?.paused ?? false,
    pausedReason: row?.pausedReason,
    categoryPolicies: { ...defaults, ...stored },
    businessHours: (row?.businessHours as unknown as BusinessHours) ?? DEFAULT_HOURS,
    dailyActionLimit: row?.dailyActionLimit ?? 50,
    monthlyAiBudget: row?.monthlyAiBudget ?? null,
    senderName: row?.senderName,
    signature: row?.signature,
  };
}

export async function updateAutonomyConfig(
  workspaceId: string,
  patch: Partial<AutonomyConfig>
): Promise<AutonomyConfig> {
  const data: Prisma.AutonomySettingsUncheckedCreateInput = { workspaceId };
  if (patch.level !== undefined) data.level = patch.level;
  if (patch.paused !== undefined) data.paused = patch.paused;
  if (patch.pausedReason !== undefined) data.pausedReason = patch.pausedReason;
  if (patch.categoryPolicies !== undefined)
    data.categoryPolicies = patch.categoryPolicies as unknown as Prisma.InputJsonValue;
  if (patch.businessHours !== undefined)
    data.businessHours = patch.businessHours as unknown as Prisma.InputJsonValue;
  if (patch.dailyActionLimit !== undefined) data.dailyActionLimit = patch.dailyActionLimit;
  if (patch.monthlyAiBudget !== undefined) data.monthlyAiBudget = patch.monthlyAiBudget;
  if (patch.senderName !== undefined) data.senderName = patch.senderName;
  if (patch.signature !== undefined) data.signature = patch.signature;

  const { workspaceId: _w, ...updateData } = data;
  void _w;
  await db.autonomySettings.upsert({
    where: { workspaceId },
    create: data,
    update: updateData,
  });
  return getAutonomyConfig(workspaceId);
}

/** The kill switch. */
export async function setPaused(workspaceId: string, paused: boolean, reason?: string) {
  await db.autonomySettings.upsert({
    where: { workspaceId },
    create: { workspaceId, paused, pausedReason: reason ?? null },
    update: { paused, pausedReason: reason ?? null },
  });
}
