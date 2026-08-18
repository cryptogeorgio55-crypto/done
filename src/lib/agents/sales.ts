import type { Agent, AgentProposal } from "./types";
import { scoreProposal, DEFAULT_BUDGET } from "./types";

/**
 * SALES AGENT — owns the pipeline. Turns hot leads, due follow-ups and dormant
 * relationships in the twin into grounded next steps. External messages always
 * require approval here (policy decides the final gate at execution).
 */
export const salesAgent: Agent = {
  id: "sales",
  role: "Works the pipeline: hot leads, follow-ups, reactivation",
  budget: DEFAULT_BUDGET,

  async produce(twin) {
    const out: AgentProposal[] = [];

    // Hot leads — engaged and recently in touch. Freshness rewards recency.
    for (const p of twin.people.hot.slice(0, 4)) {
      const hrs = p.lastContactHrs ?? 72;
      const base = {
        agent: "sales" as const,
        kind: "sales_followup" as const,
        title: `Follow up ${p.name} now`,
        summary: `${p.name} is engaged (${p.stage}) and was last in touch ${hrs < 24 ? `${Math.max(1, hrs)}h` : `${Math.round(hrs / 24)}d`} ago.`,
        reason:
          "An engaged lead who replied recently is a strong buying signal — responding while intent is high moves the deal forward.",
        recommendedAction: `Reply to ${p.name} and propose a concrete next step (call, kickoff date, or proposal).`,
        priority: "high" as const,
        impact: "high" as const,
        risk: "low" as const,
        requiresApproval: true,
        subject: { type: "lead", id: p.leadId, label: p.name },
        toolsRequired: ["draft_reply", "send_message"],
        missionable: true,
      };
      out.push({ ...base, score: scoreProposal(base, Math.max(0, 30 - hrs)) });
    }

    // Follow-ups whose time has arrived (skip ones already covered as hot).
    const hotIds = new Set(twin.people.hot.map((p) => p.leadId));
    for (const p of twin.people.followupsDue.slice(0, 4)) {
      if (hotIds.has(p.leadId)) continue;
      const base = {
        agent: "sales" as const,
        kind: "sales_followup" as const,
        title: `Follow-up due for ${p.name}`,
        summary: `A follow-up you scheduled for ${p.name} is now due.`,
        reason: "Following up on time is the difference between a warm lead and a lost one.",
        recommendedAction: `Send ${p.name} the follow-up you planned.`,
        priority: "medium" as const,
        impact: "medium" as const,
        risk: "low" as const,
        requiresApproval: true,
        subject: { type: "lead", id: p.leadId, label: p.name },
        toolsRequired: ["draft_reply", "send_message"],
        missionable: true,
      };
      out.push({ ...base, score: scoreProposal(base, 12) });
    }

    // Dormant leads worth reactivating — aggregated into one mission-worthy move.
    if (twin.people.stale.length >= 2) {
      const n = twin.people.stale.length;
      const base = {
        agent: "sales" as const,
        kind: "lead_reactivation" as const,
        title: `${n} old leads are worth reactivating`,
        summary: "These leads previously showed interest but have gone quiet for 14+ days.",
        reason:
          "Warm leads that went quiet are far cheaper to re-engage than new acquisition — a personal, specific nudge often revives them.",
        recommendedAction: "Prepare personalized reactivation messages for your review.",
        priority: "medium" as const,
        impact: "medium" as const,
        risk: "low" as const,
        requiresApproval: true,
        subject: null,
        toolsRequired: ["create_campaign", "draft_reply"],
        missionable: true,
      };
      out.push({ ...base, score: scoreProposal(base, Math.min(20, n * 2)) });
    }

    return out;
  },
};
