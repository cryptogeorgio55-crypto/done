import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { computeBusinessState, type BusinessState } from "@/lib/intelligence/business-state";

/**
 * BUSINESS DIGITAL TWIN
 *
 * A continuously-derivable, structured representation of the whole connected
 * business "right now". It is the shared intelligence substrate every AI agent
 * reads from — so agents reason over one consistent picture instead of each
 * re-querying and re-deriving the world.
 *
 * Design rules (kept honest):
 *  - Everything here is computed from REAL rows. Nothing is invented.
 *  - It is DETERMINISTIC and needs zero AI budget, so it powers offline/tests
 *    and never blocks a page load on a model call.
 *  - It composes the existing BusinessState and adds the relational layer
 *    (people, goals, commitments) agents need to make grounded decisions.
 */

export interface TwinPerson {
  leadId: string;
  name: string;
  stage: string;
  temperature: "hot" | "warm" | "cold";
  lastContactHrs: number | null;
  followUpDue: boolean;
  estimatedValue: string | null;
}

export interface TwinGoal {
  key: string;
  label: string;
  priority: number;
}

export interface TwinCommitment {
  id: string;
  direction: "ours" | "theirs";
  party: string;
  text: string;
  dueAt: string | null;
  overdue: boolean;
}

export interface TwinMissionRef {
  id: string;
  title: string;
  kind: string;
  status: string;
  progress: number; // 0..1 of steps done
}

export interface BusinessTwin {
  workspaceId: string;
  generatedAt: string;
  state: BusinessState;
  people: {
    hot: TwinPerson[];
    stale: TwinPerson[];
    followupsDue: TwinPerson[];
  };
  goals: TwinGoal[];
  commitments: {
    ourOpen: TwinCommitment[]; // promises WE owe
    theirs: TwinCommitment[]; // things others promised us (don't chase early)
    overdue: number;
  };
  missions: {
    active: TwinMissionRef[];
    waitingApproval: number;
  };
  counts: {
    people: number;
    openConversations: number;
  };
}

const DAY = 24 * 3600_000;

function hoursSince(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.round((Date.now() - d.getTime()) / 3600_000);
}

function temperature(stage: string, lastContactHrs: number | null): TwinPerson["temperature"] {
  if (lastContactHrs !== null && lastContactHrs <= 72 && ["contacted", "interested", "followup"].includes(stage)) {
    return "hot";
  }
  if (lastContactHrs !== null && lastContactHrs >= 14 * 24) return "cold";
  return "warm";
}

function toPerson(l: {
  id: string; name: string; stage: string; lastContactAt: Date | null;
  nextFollowUpAt: Date | null; estimatedValue: string | null;
}): TwinPerson {
  const hrs = hoursSince(l.lastContactAt);
  return {
    leadId: l.id,
    name: l.name,
    stage: l.stage,
    temperature: temperature(l.stage, hrs),
    lastContactHrs: hrs,
    followUpDue: !!(l.nextFollowUpAt && l.nextFollowUpAt <= new Date()),
    estimatedValue: l.estimatedValue,
  };
}

/**
 * Build the Business Digital Twin for a workspace from real records. Cheap
 * enough to call on demand; agents and Next Move consume the result rather than
 * re-querying the database themselves.
 */
export async function buildTwin(ctx: WorkspaceContext): Promise<BusinessTwin> {
  const wsId = ctx.workspace.id;
  const now = new Date();
  const hotCutoff = new Date(now.getTime() - 3 * DAY);
  const staleCutoff = new Date(now.getTime() - 14 * DAY);

  const leadSelect = {
    id: true, name: true, stage: true, lastContactAt: true,
    nextFollowUpAt: true, estimatedValue: true,
  } as const;

  const [
    state,
    hotLeads,
    staleLeads,
    dueLeads,
    goals,
    ourCommitments,
    theirCommitments,
    activeMissions,
    peopleCount,
    openConversations,
  ] = await Promise.all([
    computeBusinessState(ctx),
    db.lead.findMany({
      where: {
        workspaceId: wsId, deletedAt: null,
        stage: { in: ["contacted", "interested", "followup"] },
        lastContactAt: { gte: hotCutoff },
      },
      orderBy: { lastContactAt: "desc" }, take: 10, select: leadSelect,
    }),
    db.lead.findMany({
      where: {
        workspaceId: wsId, deletedAt: null,
        stage: { in: ["contacted", "interested", "followup"] },
        lastContactAt: { lte: staleCutoff },
      },
      orderBy: { lastContactAt: "asc" }, take: 25, select: leadSelect,
    }),
    db.lead.findMany({
      where: {
        workspaceId: wsId, deletedAt: null,
        stage: { notIn: ["won", "lost"] },
        nextFollowUpAt: { lte: now },
      },
      orderBy: { nextFollowUpAt: "asc" }, take: 10, select: leadSelect,
    }),
    db.businessGoal.findMany({ where: { workspaceId: wsId }, orderBy: { priority: "desc" } }),
    db.commitment.findMany({
      where: { workspaceId: wsId, direction: "ours", status: { in: ["open", "overdue"] } },
      orderBy: [{ dueAt: "asc" }], take: 20,
    }),
    db.commitment.findMany({
      where: { workspaceId: wsId, direction: "theirs", status: { in: ["open", "overdue"] } },
      orderBy: [{ dueAt: "asc" }], take: 20,
    }),
    db.mission.findMany({
      where: { workspaceId: wsId, status: { in: ["active", "waiting_approval", "blocked"] } },
      orderBy: { priority: "desc" },
      include: { steps: { select: { status: true } } },
      take: 20,
    }),
    db.lead.count({ where: { workspaceId: wsId, deletedAt: null } }),
    db.conversation.count({ where: { workspaceId: wsId } }),
  ]);

  const commitmentRef = (c: (typeof ourCommitments)[number]): TwinCommitment => ({
    id: c.id,
    direction: c.direction as "ours" | "theirs",
    party: c.party,
    text: c.text,
    dueAt: c.dueAt ? c.dueAt.toISOString() : null,
    overdue: !!(c.dueAt && c.dueAt < now) || c.status === "overdue",
  });

  const missionRefs: TwinMissionRef[] = activeMissions.map((m) => {
    const total = m.steps.length || 1;
    const done = m.steps.filter((s) => s.status === "done").length;
    return { id: m.id, title: m.title, kind: m.kind, status: m.status, progress: done / total };
  });

  const ourOpen = ourCommitments.map(commitmentRef);

  return {
    workspaceId: wsId,
    generatedAt: now.toISOString(),
    state,
    people: {
      hot: hotLeads.map(toPerson),
      stale: staleLeads.map(toPerson),
      followupsDue: dueLeads.map(toPerson),
    },
    goals: goals.map((g) => ({ key: g.key, label: g.label, priority: g.priority })),
    commitments: {
      ourOpen,
      theirs: theirCommitments.map(commitmentRef),
      overdue: ourOpen.filter((c) => c.overdue).length,
    },
    missions: {
      active: missionRefs,
      waitingApproval: missionRefs.filter((m) => m.status === "waiting_approval").length,
    },
    counts: { people: peopleCount, openConversations },
  };
}
