import type { AutonomyConfig, ActionCategory, ActionRisk, PolicyDecision, BusinessHours } from "./types";
import { ACTION_CATEGORIES } from "./types";

// The Policy Engine — the real security boundary for autonomy.
//
// The LLM only ever *requests* actions. This module decides whether each request
// is allowed to run automatically, needs human approval, or is forbidden. It
// runs OUTSIDE the model and cannot be influenced by anything an email says.

export interface ProposedAction {
  category: ActionCategory;
  /** Number of external recipients, if this is a communication. */
  recipientCount?: number;
  /** Classifier confidence (0..1). Low confidence forces human review. */
  confidence?: number;
  /** Explicit risk override; otherwise derived from the category. */
  risk?: ActionRisk;
}

export interface PolicyResult {
  decision: PolicyDecision;
  risk: ActionRisk;
  reason: string;
}

const CONFIDENCE_FLOOR = 0.55;
const BULK_THRESHOLD = 10;

function riskFor(category: ActionCategory, override?: ActionRisk): ActionRisk {
  if (override) return override;
  return ACTION_CATEGORIES.find((c) => c.key === category)?.defaultRisk ?? "medium";
}

/** Categories that touch external systems (as opposed to internal-only). */
const EXTERNAL_CATEGORIES = new Set<ActionCategory>([
  "sales_reply", "customer_reply", "complaint", "financial",
  "schedule_meeting", "send_quotation", "send_followup", "bulk_communication",
]);

function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Whether `now` falls within configured business hours (best-effort TZ). */
export function withinBusinessHours(hours: BusinessHours, now = new Date()): boolean {
  // Resolve "now" in the configured timezone.
  let local = now;
  try {
    local = new Date(now.toLocaleString("en-US", { timeZone: hours.timezone || "UTC" }));
  } catch {
    /* invalid TZ → treat as UTC/local */
  }
  const day = local.getDay();
  if (!hours.days.includes(day)) return false;
  const mins = local.getHours() * 60 + local.getMinutes();
  return mins >= parseHM(hours.start) && mins < parseHM(hours.end);
}

/**
 * Decide the policy for a proposed action given the workspace's autonomy config.
 * The order of guards matters — hard prohibitions win over configuration.
 */
export function decidePolicy(config: AutonomyConfig, action: ProposedAction, now = new Date()): PolicyResult {
  const risk = riskFor(action.category, action.risk);

  // 0. Kill switch: nothing external runs while paused.
  if (config.paused) {
    if (EXTERNAL_CATEGORIES.has(action.category)) {
      return { decision: "approval", risk, reason: "Autopilot is paused — queued for your approval." };
    }
  }

  // 1. Hard prohibitions — never automatic, regardless of level/config.
  if (action.category === "financial" || action.category === "destructive") {
    return { decision: "never", risk: "high", reason: "This kind of action is never done automatically." };
  }

  // 2. Configured category policy is the baseline.
  let decision: PolicyDecision = config.categoryPolicies[action.category] ?? "approval";

  // 3. Assist level never takes external action automatically.
  if (config.level === "assist" && EXTERNAL_CATEGORIES.has(action.category) && decision === "auto") {
    decision = "approval";
  }

  // 4. Low classifier confidence forces human review for anything non-trivial.
  if (decision === "auto" && (action.confidence ?? 1) < CONFIDENCE_FLOOR && risk !== "low") {
    return { decision: "approval", risk, reason: "I wasn't confident enough to act on this alone." };
  }

  // 5. Bulk communication always needs approval unless explicitly configured auto.
  if ((action.recipientCount ?? 0) >= BULK_THRESHOLD) {
    const bulkPolicy = config.categoryPolicies.bulk_communication ?? "approval";
    if (bulkPolicy !== "auto") {
      return {
        decision: "approval",
        risk: "high",
        reason: `This would message ${action.recipientCount} people — approval required.`,
      };
    }
  }

  // 6. Outside business hours, auto external replies are prepared, not sent
  //    (unless the owner is on full autopilot).
  if (
    decision === "auto" &&
    EXTERNAL_CATEGORIES.has(action.category) &&
    config.level !== "autopilot" &&
    !withinBusinessHours(config.businessHours, now)
  ) {
    return { decision: "approval", risk, reason: "Outside business hours — prepared for your review." };
  }

  const reasons: Record<PolicyDecision, string> = {
    auto: "Allowed to run automatically by your settings.",
    approval: "Prepared for your approval.",
    never: "Not allowed to run automatically.",
    ignore: "Not worth acting on.",
  };
  return { decision, risk, reason: reasons[decision] };
}
