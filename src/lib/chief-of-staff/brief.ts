import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { runCoordinator } from "@/lib/agents/coordinator";
import { computeGoalProgress, type GoalProgress } from "@/lib/goals/engine";
import { markOverdueCommitments } from "@/lib/commitments/tracker";
import { createMissionFromProposal } from "@/lib/missions/engine";
import type { AgentProposal } from "@/lib/agents/types";

/**
 * CHIEF OF STAFF
 *
 * A concise daily executive surface: what changed, the biggest opportunity, the
 * biggest risk, the schedule, and one clear recommendation — all composed from
 * the real Digital Twin + agent team, deterministically. "Run Today" then turns
 * the top recommendations into durable Missions the team pursues.
 */

export interface MorningBrief {
  generatedAt: string;
  greetingName: string;
  whatChanged: string[];
  biggestOpportunity: { title: string; detail: string } | null;
  biggestRisk: { title: string; detail: string } | null;
  schedule: { title: string; at: string } | null;
  recommendation: string;
  goals: GoalProgress[];
  /** The ranked proposals "Run Today" would act on. */
  plan: { proposalId: string; title: string; agent: string; priority: string; missionable: boolean }[];
}

const DAY = 24 * 3600_000;
const proposalId = (p: AgentProposal) => `${p.agent}:${p.subject?.id ?? p.kind}`;

export async function buildMorningBrief(ctx: WorkspaceContext): Promise<MorningBrief> {
  // Keep commitment states honest before we read them.
  await markOverdueCommitments(ctx);

  const { twin, proposals } = await runCoordinator(ctx);
  const goals = await computeGoalProgress(ctx, twin);

  // What changed overnight — grounded in real rows from the last 24h.
  const since = new Date(Date.now() - DAY);
  const [newLeads, repliedEvents, handled] = await Promise.all([
    db.lead.count({ where: { workspaceId: ctx.workspace.id, deletedAt: null, createdAt: { gte: since } } }),
    db.event.count({ where: { workspaceId: ctx.workspace.id, type: "email.received", occurredAt: { gte: since } } }),
    db.actionLog.count({ where: { workspaceId: ctx.workspace.id, status: "success", createdAt: { gte: since } } }),
  ]);
  const whatChanged: string[] = [];
  if (newLeads > 0) whatChanged.push(`${newLeads} new lead${newLeads > 1 ? "s" : ""} arrived.`);
  if (repliedEvents > 0) whatChanged.push(`${repliedEvents} inbound email${repliedEvents > 1 ? "s" : ""} came in.`);
  if (handled > 0) whatChanged.push(`DONE handled ${handled} action${handled > 1 ? "s" : ""}.`);
  if (twin.commitments.overdue > 0) whatChanged.push(`${twin.commitments.overdue} promise(s) went overdue.`);
  if (whatChanged.length === 0) whatChanged.push("A quiet night — nothing new came in.");

  // Biggest opportunity = the highest-scoring positive sales/opportunity move.
  const opp = proposals.find((p) => ["sales_followup", "lead_reactivation", "opportunity"].includes(p.kind));
  const biggestOpportunity = opp ? { title: opp.title, detail: opp.summary } : null;

  // Biggest risk = an overdue promise or an unhandled complaint/attention signal.
  const riskProp = proposals.find((p) =>
    (p.kind === "commitment" && p.priority === "high") || p.kind === "needs_attention"
  );
  const biggestRisk = riskProp
    ? { title: riskProp.title, detail: riskProp.summary }
    : twin.commitments.overdue > 0
    ? { title: "An overdue promise", detail: `${twin.commitments.overdue} commitment(s) past due.` }
    : null;

  const schedule = twin.state.calendar.nextMeeting
    ? { title: twin.state.calendar.nextMeeting.title, at: twin.state.calendar.nextMeeting.at }
    : null;

  const top = proposals[0];
  const recommendation = top
    ? `Start with: ${top.title}. ${top.recommendedAction}`
    : "You're clear — nothing needs you right now.";

  return {
    generatedAt: twin.generatedAt,
    greetingName: ctx.user.name?.split(" ")[0] || "there",
    whatChanged,
    biggestOpportunity,
    biggestRisk,
    schedule,
    recommendation,
    goals,
    plan: proposals.slice(0, 5).map((p) => ({
      proposalId: proposalId(p),
      title: p.title,
      agent: p.agent,
      priority: p.priority,
      missionable: p.missionable,
    })),
  };
}

export interface RunTodayResult {
  launched: { missionId: string; title: string }[];
  skipped: number;
}

/**
 * RUN TODAY — turn the top missionable recommendations into durable Missions.
 * Reuses an existing active mission for the same subject instead of duplicating.
 * Missions are created at `prepare` autonomy: they progress internal steps and
 * stop at the approval boundary. Nothing external fires without the owner.
 */
export async function runToday(ctx: WorkspaceContext, opts: { max?: number } = {}): Promise<RunTodayResult> {
  const max = opts.max ?? 3;
  const { proposals } = await runCoordinator(ctx);
  const missionable = proposals.filter((p) => p.missionable).slice(0, max);

  const launched: { missionId: string; title: string }[] = [];
  let skipped = 0;

  for (const p of missionable) {
    if (p.subject) {
      const existing = await db.mission.findFirst({
        where: {
          workspaceId: ctx.workspace.id,
          subjectType: p.subject.type,
          subjectId: p.subject.id,
          status: { in: ["active", "waiting_approval", "blocked"] },
        },
      });
      if (existing) {
        skipped++;
        continue;
      }
    }
    const m = await createMissionFromProposal(ctx, p, { origin: "chief_of_staff" });
    launched.push({ missionId: m.id, title: m.title });
  }

  return { launched, skipped };
}
