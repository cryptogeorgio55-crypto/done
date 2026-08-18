// Shared vocabulary for the autonomy system.

// "shadow" observes and recommends but NEVER takes an external action — the
// trust-building entry level. "assist"/"prepare" queue actions for approval;
// "autopilot" executes approved categories automatically.
export type AutonomyLevel = "shadow" | "assist" | "prepare" | "autopilot" | "custom";
export type ActionRisk = "low" | "medium" | "high";
/** What the policy engine decides for a proposed action. */
export type PolicyDecision = "auto" | "approval" | "never" | "ignore";

/**
 * Action categories map proposed tool calls onto policy rules. Owners configure
 * one policy per category (Autopilot → custom).
 */
export type ActionCategory =
  | "sales_reply"
  | "customer_reply"
  | "complaint"
  | "financial"
  | "schedule_meeting"
  | "send_quotation"
  | "send_followup"
  | "update_lead"
  | "create_lead"
  | "internal_task"
  | "bulk_communication"
  | "destructive";

export const ACTION_CATEGORIES: { key: ActionCategory; label: string; defaultRisk: ActionRisk }[] = [
  { key: "sales_reply", label: "Reply to new sales inquiries", defaultRisk: "medium" },
  { key: "customer_reply", label: "Reply to existing customers", defaultRisk: "medium" },
  { key: "complaint", label: "Respond to complaints", defaultRisk: "high" },
  { key: "financial", label: "Financial / legal emails", defaultRisk: "high" },
  { key: "schedule_meeting", label: "Schedule meetings", defaultRisk: "medium" },
  { key: "send_quotation", label: "Send quotations", defaultRisk: "high" },
  { key: "send_followup", label: "Send follow-ups", defaultRisk: "medium" },
  { key: "update_lead", label: "Update leads / CRM", defaultRisk: "low" },
  { key: "create_lead", label: "Create leads", defaultRisk: "low" },
  { key: "internal_task", label: "Internal tasks & drafts", defaultRisk: "low" },
  { key: "bulk_communication", label: "Bulk messaging", defaultRisk: "high" },
  { key: "destructive", label: "Delete / cancel / refund", defaultRisk: "high" },
];

export interface BusinessHours {
  timezone: string;
  days: number[]; // 0=Sun .. 6=Sat
  start: string; // "09:00"
  end: string; // "18:00"
}

export interface AutonomyConfig {
  level: AutonomyLevel;
  paused: boolean;
  pausedReason?: string | null;
  categoryPolicies: Partial<Record<ActionCategory, PolicyDecision>>;
  businessHours: BusinessHours;
  dailyActionLimit: number;
  monthlyAiBudget: number | null;
  senderName?: string | null;
  signature?: string | null;
}
