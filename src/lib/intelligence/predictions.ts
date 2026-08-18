import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { buildTwin, type BusinessTwin } from "@/lib/digital-twin/twin";

/**
 * PREDICTION & ANOMALY ENGINE
 *
 * Controlled, grounded foresight. Predictions use hedged language ("likely",
 * "worth attention") and are derived from real activity — never invented
 * certainty. Anomalies are computed statistically (today vs a trailing
 * baseline) before any interpretation, so we don't cry wolf.
 */

export interface Prediction {
  id: string;
  subject: string;
  likelihood: "likely" | "worth_attention";
  statement: string;
  basis: string; // the real signal it's grounded in
}

export interface Anomaly {
  id: string;
  statement: string;
  basis: string;
}

const DAY = 24 * 3600_000;

export async function predict(ctx: WorkspaceContext, twin?: BusinessTwin): Promise<Prediction[]> {
  const t = twin ?? (await buildTwin(ctx));
  const out: Prediction[] = [];

  // A hot lead that hasn't been contacted in ~2 days is likely cooling.
  for (const p of t.people.hot) {
    if (p.lastContactHrs !== null && p.lastContactHrs >= 48) {
      out.push({
        id: `cooling:${p.leadId}`,
        subject: p.name,
        likelihood: "likely",
        statement: `${p.name} is likely to cool off without a follow-up soon.`,
        basis: `Engaged (${p.stage}) but last contact was ${Math.round(p.lastContactHrs / 24)}d ago.`,
      });
    }
  }

  // A meeting in the next 24h likely needs preparation.
  if (t.state.calendar.nextMeeting) {
    const hrs = (new Date(t.state.calendar.nextMeeting.at).getTime() - Date.now()) / 3600_000;
    if (hrs > 0 && hrs <= 24) {
      out.push({
        id: "meeting_prep",
        subject: t.state.calendar.nextMeeting.title,
        likelihood: "worth_attention",
        statement: `"${t.state.calendar.nextMeeting.title}" likely needs a brief before it starts.`,
        basis: `Meeting is in ~${Math.round(hrs)}h.`,
      });
    }
  }

  return out;
}

export async function detectAnomalies(ctx: WorkspaceContext): Promise<Anomaly[]> {
  const wsId = ctx.workspace.id;
  const now = Date.now();
  const out: Anomaly[] = [];

  // Support-email volume: today vs the trailing 7-day daily average.
  const [todayEmails, weekEmails] = await Promise.all([
    db.event.count({ where: { workspaceId: wsId, type: "email.received", occurredAt: { gte: new Date(now - DAY) } } }),
    db.event.count({ where: { workspaceId: wsId, type: "email.received", occurredAt: { gte: new Date(now - 7 * DAY) } } }),
  ]);
  const dailyAvg = weekEmails / 7;
  if (dailyAvg >= 1 && todayEmails >= dailyAvg * 3) {
    out.push({
      id: "email_spike",
      statement: `You received about ${Math.round(todayEmails / Math.max(1, dailyAvg))}× your usual email volume today.`,
      basis: `${todayEmails} today vs a ~${dailyAvg.toFixed(1)}/day average.`,
    });
  }

  // No new leads in a while (drought), when the business normally gets some.
  const lastLead = await db.lead.findFirst({
    where: { workspaceId: wsId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const totalLeads = await db.lead.count({ where: { workspaceId: wsId, deletedAt: null } });
  if (lastLead && totalLeads >= 3) {
    const days = Math.floor((now - lastLead.createdAt.getTime()) / DAY);
    if (days >= 8) {
      out.push({
        id: "lead_drought",
        statement: `No new leads have arrived in ${days} days.`,
        basis: `Last new lead was ${days} days ago; you normally see more.`,
      });
    }
  }

  return out;
}
