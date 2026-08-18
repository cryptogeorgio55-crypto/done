import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";

/**
 * BUSINESS STATE — a structured, derived snapshot of what is happening in the
 * business right now. It is computed from real records (leads, approvals,
 * events, calendar, content) — never invented — and is the shared substrate the
 * Next Move engine, the Home command center, and the mobile experience read
 * from, so they don't each re-derive the world on every render.
 */
export interface MeetingRef {
  title: string;
  at: string; // ISO
  entityId?: string;
}

export interface BusinessState {
  generatedAt: string;
  sales: {
    hotLeads: number; // engaged leads with recent inbound activity
    staleLeads: number; // previously-interested leads gone quiet
    followupsDue: number; // follow-ups whose time has arrived
  };
  customers: {
    attentionRequired: number; // unhandled "needs attention" signals
  };
  calendar: {
    nextMeeting: MeetingRef | null;
    meetingsNext24h: number;
  };
  marketing: {
    contentGapDays: number; // days since last content was created
  };
  approvals: {
    pending: number;
  };
  activity: {
    handledLast24h: number; // AI actions completed in the last day
  };
}

const DAY = 24 * 3600_000;

/** Best-effort extraction of a start time from a calendar ExternalEntity.data blob. */
function readEventStart(data: unknown): Date | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const raw =
    (d.start as { dateTime?: string; date?: string } | string | undefined) ??
    (d.startsAt as string | undefined) ??
    (d.startTime as string | undefined);
  const value = typeof raw === "string" ? raw : raw?.dateTime ?? raw?.date;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Compute the current Business State for a workspace from real records. */
export async function computeBusinessState(ctx: WorkspaceContext): Promise<BusinessState> {
  const wsId = ctx.workspace.id;
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 14 * DAY);
  const hotCutoff = new Date(now.getTime() - 3 * DAY);
  const dayAhead = new Date(now.getTime() + DAY);
  const dayAgo = new Date(now.getTime() - DAY);

  const [
    hotLeads,
    staleLeads,
    followupsDue,
    attentionRequired,
    pendingApprovals,
    upcomingEvents,
    lastContent,
    handledLast24h,
  ] = await Promise.all([
    db.lead.count({
      where: {
        workspaceId: wsId, deletedAt: null,
        stage: { in: ["contacted", "interested", "followup"] },
        lastContactAt: { gte: hotCutoff },
      },
    }),
    db.lead.count({
      where: {
        workspaceId: wsId, deletedAt: null,
        stage: { in: ["contacted", "interested", "followup"] },
        lastContactAt: { lte: staleCutoff },
      },
    }),
    db.lead.count({
      where: {
        workspaceId: wsId, deletedAt: null,
        stage: { notIn: ["won", "lost"] },
        nextFollowUpAt: { lte: now },
      },
    }),
    db.event.count({
      where: { workspaceId: wsId, category: "needs_attention", status: { in: ["new", "processing"] } },
    }),
    db.approval.count({ where: { workspaceId: wsId, status: "pending" } }),
    db.externalEntity.findMany({
      where: { workspaceId: wsId, kind: "event" },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, displayName: true, data: true },
    }),
    db.contentItem.findFirst({
      where: { workspaceId: wsId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.actionLog.count({
      where: { workspaceId: wsId, status: "success", createdAt: { gte: dayAgo } },
    }),
  ]);

  // Derive the next upcoming meeting + how many are in the next 24h.
  const upcoming = upcomingEvents
    .map((e) => ({ start: readEventStart(e.data), title: e.displayName ?? "Meeting", id: e.id }))
    .filter((e): e is { start: Date; title: string; id: string } => e.start !== null && e.start >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const nextMeeting: MeetingRef | null = upcoming[0]
    ? { title: upcoming[0].title, at: upcoming[0].start.toISOString(), entityId: upcoming[0].id }
    : null;
  const meetingsNext24h = upcoming.filter((e) => e.start <= dayAhead).length;

  const contentGapDays = lastContent
    ? Math.floor((now.getTime() - lastContent.createdAt.getTime()) / DAY)
    : 99;

  return {
    generatedAt: now.toISOString(),
    sales: { hotLeads, staleLeads, followupsDue },
    customers: { attentionRequired },
    calendar: { nextMeeting, meetingsNext24h },
    marketing: { contentGapDays },
    approvals: { pending: pendingApprovals },
    activity: { handledLast24h },
  };
}
