import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";

// The MORNING BRIEFING aggregates the highest-value things across connected
// systems into one glanceable digest — no need to open five apps.

export interface BriefingSection {
  key: string;
  label: string;
  count: number;
  detail: string;
}

export interface Briefing {
  greetingName: string;
  generatedAt: string;
  sections: BriefingSection[];
  pendingApprovals: number;
  newInboxItems: number;
}

export async function buildBriefing(ctx: WorkspaceContext): Promise<Briefing> {
  const wsId = ctx.workspace.id;
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600_000);

  const [
    followupsDue,
    newLeads,
    newInbox,
    pendingApprovals,
    meetingsToday,
    lastContent,
    staleLeads,
  ] = await Promise.all([
    db.lead.count({ where: { workspaceId: wsId, deletedAt: null, nextFollowUpAt: { lte: now }, stage: { notIn: ["won", "lost"] } } }),
    db.lead.count({ where: { workspaceId: wsId, deletedAt: null, createdAt: { gte: fourDaysAgo } } }),
    db.event.count({ where: { workspaceId: wsId, category: "sales", createdAt: { gte: fourDaysAgo } } }),
    db.approval.count({ where: { workspaceId: wsId, status: "pending" } }),
    db.externalEntity.findMany({ where: { workspaceId: wsId, provider: "google_calendar", kind: "event" } }),
    db.contentItem.findFirst({ where: { workspaceId: wsId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.lead.count({ where: { workspaceId: wsId, deletedAt: null, stage: { in: ["contacted", "interested", "followup"] }, lastContactAt: { lte: fourDaysAgo } } }),
  ]);

  const todaysMeetings = meetingsToday.filter((m) => {
    const start = new Date((m.data as { startsAt?: string }).startsAt ?? 0);
    return start >= startOfDay && start <= endOfDay && start >= now;
  });

  const daysSinceContent = lastContent ? Math.floor((now.getTime() - lastContent.createdAt.getTime()) / (24 * 3600_000)) : 99;

  const sections: BriefingSection[] = [];
  if (followupsDue + staleLeads > 0)
    sections.push({ key: "needs_attention", label: "Needs attention", count: followupsDue + staleLeads, detail: `${followupsDue + staleLeads} lead${followupsDue + staleLeads === 1 ? "" : "s"} need follow-ups.` });
  if (newInbox > 0)
    sections.push({ key: "sales", label: "Sales", count: newInbox, detail: `${newInbox} new inquir${newInbox === 1 ? "y" : "ies"} recently.` });
  if (todaysMeetings.length > 0) {
    const next = todaysMeetings.sort((a, b) => (a.data as { startsAt: string }).startsAt.localeCompare((b.data as { startsAt: string }).startsAt))[0];
    sections.push({ key: "meetings", label: "Meetings", count: todaysMeetings.length, detail: `${(next.data as { title?: string }).title} at ${new Date((next.data as { startsAt: string }).startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` });
  }
  if (newLeads > 0)
    sections.push({ key: "customers", label: "New leads", count: newLeads, detail: `${newLeads} new lead${newLeads === 1 ? "" : "s"} this week.` });
  if (daysSinceContent >= 4)
    sections.push({ key: "marketing", label: "Marketing", count: 1, detail: `You haven't posted in ${daysSinceContent === 99 ? "a while" : `${daysSinceContent} days`}.` });

  return {
    greetingName: (ctx.user.name || "there").split(" ")[0],
    generatedAt: now.toISOString(),
    sections,
    pendingApprovals,
    newInboxItems: await db.event.count({ where: { workspaceId: wsId, status: "new" } }),
  };
}
