import Link from "next/link";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { getUsageSnapshot } from "@/lib/usage";
import { buildBriefing } from "@/lib/autopilot/briefing";
import { listAccounts } from "@/lib/connectors/accounts";
import { listRules } from "@/lib/automations/rules";
import { buildNextMoves } from "@/lib/intelligence/next-move";
import { NextMoveBoard } from "@/components/app/next-move";
import { DonePulse, PULSE_COPY, type PulseState } from "@/components/app/done-pulse";
import { LiveActivity } from "@/components/app/live-activity";
import { DoneStatus } from "@/components/app/done-status";
import { IconArrow, IconInbox, IconLeads, IconToday, IconAutopilot, IconApprovals } from "@/components/icons";

const PROVIDER_LABEL: Record<string, string> = {
  gmail: "Gmail",
  google_gmail: "Gmail",
  google_calendar: "Calendar",
  calendar: "Calendar",
};

function timeEyebrow(d: Date) {
  return d
    .toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })
    .toUpperCase();
}

export default async function DashboardPage() {
  const ctx = await requireWorkspaceContext();
  const wsId = ctx.workspace.id;
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [
    briefing,
    accounts,
    rules,
    pendingApprovals,
    pendingApprovalCount,
    followupsDue,
    meetings,
    recentLogs,
    handledToday,
    usage,
    hotLeads,
    newInbox,
    nextMoveResult,
  ] = await Promise.all([
    buildBriefing(ctx),
    listAccounts(wsId),
    listRules(wsId),
    db.approval.findMany({ where: { workspaceId: wsId, status: "pending" }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.approval.count({ where: { workspaceId: wsId, status: "pending" } }),
    db.lead.count({ where: { workspaceId: wsId, deletedAt: null, nextFollowUpAt: { lte: now }, stage: { notIn: ["won", "lost"] } } }),
    db.externalEntity.findMany({ where: { workspaceId: wsId, provider: "google_calendar", kind: "event" } }),
    db.actionLog.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.actionLog.count({ where: { workspaceId: wsId, status: "executed", createdAt: { gte: startOfDay } } }),
    getUsageSnapshot(wsId),
    db.lead.count({ where: { workspaceId: wsId, deletedAt: null, stage: { in: ["interested", "followup"] } } }),
    db.event.count({ where: { workspaceId: wsId, status: "new" } }),
    buildNextMoves(ctx, { limit: 5 }),
  ]);

  const firstName = (ctx.user.name || "there").split(" ")[0];

  // ---- What DONE is watching (real connected accounts) --------------
  const watching = accounts
    .filter((a) => a.status === "connected")
    .map((a) => PROVIDER_LABEL[a.provider] ?? a.provider);
  const automationsActive = rules.filter((r) => r.enabled).length;

  // ---- Next meeting (from synced calendar entities) -----------------
  const upcoming = meetings
    .map((m) => m.data as { startsAt?: string; title?: string })
    .filter((m) => m.startsAt && new Date(m.startsAt) >= now)
    .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));
  const nextMeeting = upcoming[0];
  const minsToMeeting = nextMeeting?.startsAt
    ? Math.round((new Date(nextMeeting.startsAt).getTime() - now.getTime()) / 60000)
    : null;

  // ---- Business state → the Pulse -----------------------------------
  const needsYou = pendingApprovalCount + followupsDue;
  const working = recentLogs.some((l) => now.getTime() - l.createdAt.getTime() < 3 * 60_000);
  const pulseState: PulseState =
    needsYou > 0 ? "attention" : hotLeads > 0 || newInbox > 0 ? "opportunity" : working ? "active" : "calm";

  const statement =
    pulseState === "attention"
      ? needsYou === 1
        ? "One thing needs you."
        : `${needsYou} things need you.`
      : pulseState === "opportunity"
        ? "DONE found something worth doing."
        : pulseState === "active"
          ? "DONE is working."
          : "Your business is under control.";

  const subline =
    `DONE has handled ${handledToday} thing${handledToday === 1 ? "" : "s"} today.` +
    (needsYou > 0 ? ` ${needsYou} need${needsYou === 1 ? "s" : ""} your attention.` : " Nothing needs you right now.");

  // ---- NEXT — what DONE predicts should happen next -----------------
  const weekendComing = [4, 5].includes(now.getDay());
  const marketing = briefing.sections.find((s) => s.key === "marketing");
  const customers = briefing.sections.find((s) => s.key === "customers");
  const next: { title: string; detail: string; href: string }[] = [];
  if (nextMeeting)
    next.push({
      title: `Prepare "${nextMeeting.title ?? "your next meeting"}"`,
      detail: minsToMeeting != null && minsToMeeting < 600 ? `Starts in ${minsToMeeting} min` : "Coming up today",
      href: "/autopilot",
    });
  if (marketing) next.push({ title: "Post something today", detail: marketing.detail, href: "/content" });
  if (customers) next.push({ title: "Welcome your new leads", detail: customers.detail, href: "/leads" });
  if (next.length === 0 && weekendComing)
    next.push({ title: "Build a weekend offer", detail: "You have open capacity this weekend.", href: "/campaigns" });

  const activityInitial = recentLogs.map((l) => ({
    id: l.id, tool: l.tool, risk: l.risk, status: l.status, decision: l.decision,
    title: l.title, detail: l.detail, reason: l.reason, reversible: l.reversible,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      {/* ---------- Top line: time + DONE presence ---------- */}
      <div className="flex items-center justify-between gap-4 animate-fade">
        <p className="eyebrow">{timeEyebrow(now)}</p>
        <DoneStatus watching={watching} automations={automationsActive} issues={0} />
      </div>

      {/* ---------- Hero: dynamic statement + Pulse ---------- */}
      <section className="grid items-center gap-6 animate-slide-up sm:grid-cols-[1fr_auto]">
        <div>
          <h1 className="display max-w-2xl">{statement}</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">{subline}</p>
          <p className="mt-1 text-sm text-muted">
            {PULSE_COPY[pulseState].sub} · Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, {firstName}.
          </p>
        </div>
        <div className="hidden sm:block">
          <DonePulse state={pulseState} size={168} />
        </div>
      </section>

      {/* ---------- Business state strip (integrated, not 5 cards) ---------- */}
      <div className="card grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x">
        <StateCell Icon={IconInbox} label="Inbox" value={newInbox > 0 ? `${newInbox}` : "0"} note={newInbox > 0 ? "need attention" : "all clear"} href="/inbox" tone={newInbox > 0 ? "amber" : "muted"} />
        <StateCell Icon={IconLeads} label="Leads" value={`${hotLeads}`} note={hotLeads > 0 ? "hot" : "quiet"} href="/leads" tone={hotLeads > 0 ? "brand" : "muted"} />
        <StateCell Icon={IconToday} label="Today" value={`${handledToday}`} note="handled" href="/automations" tone="emerald" />
        <StateCell Icon={IconAutopilot} label="Autopilot" value={automationsActive > 0 ? "Active" : "Off"} note={`${automationsActive} rules`} href="/autopilot" tone={automationsActive > 0 ? "emerald" : "muted"} />
        <StateCell Icon={IconToday} label="Next meeting" value={minsToMeeting != null && minsToMeeting < 600 ? `${minsToMeeting}m` : "—"} note={nextMeeting?.title ?? "none scheduled"} href="/autopilot" tone="muted" />
      </div>

      {/* ---------- NEXT MOVE — the signature intelligence surface ---------- */}
      <div>
        <p className="eyebrow mb-3">Here&apos;s what matters now</p>
        <NextMoveBoard initial={nextMoveResult.moves} />
      </div>

      {/* ---------- Three zones ---------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* LIVE */}
        <section className="card p-6">
          <p className="zone-eyebrow text-muted">
            <span className="live-dot" /> Live
          </p>
          <p className="mt-1 mb-5 text-sm text-ink-soft">What DONE is doing.</p>
          <LiveActivity initial={activityInitial} />
        </section>

        {/* NEEDS YOU */}
        <section className="card p-6">
          <p className="zone-eyebrow text-amber-600">Needs you</p>
          <p className="mt-1 mb-5 text-sm text-ink-soft">Decisions only you can make.</p>
          {pendingApprovals.length === 0 && followupsDue === 0 ? (
            <div className="py-2">
              <p className="text-[15px] font-medium text-ink">Nothing needs you.</p>
              <p className="mt-0.5 text-sm text-ink-soft">DONE is handling the rest.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pendingApprovals.map((a) => (
                <li key={a.id}>
                  <Link href="/approvals" className="block rounded-xl border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-surface">
                    <p className="text-[15px] font-medium leading-snug text-ink">{a.title}</p>
                    {a.previewText ? <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{a.previewText}</p> : null}
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                      Review decision <IconArrow className="h-3 w-3" />
                    </span>
                  </Link>
                </li>
              ))}
              {followupsDue > 0 ? (
                <li>
                  <Link href="/leads" className="flex items-center justify-between rounded-xl border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-surface">
                    <span className="text-[15px] font-medium text-ink">
                      {followupsDue} {followupsDue === 1 ? "person is" : "people are"} waiting for a follow-up.
                    </span>
                    <IconArrow className="h-4 w-4 shrink-0 text-brand" />
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </section>

        {/* NEXT */}
        <section className="card p-6">
          <p className="zone-eyebrow text-brand">Next</p>
          <p className="mt-1 mb-5 text-sm text-ink-soft">What DONE thinks should happen.</p>
          {next.length === 0 ? (
            <div className="py-2">
              <p className="text-[15px] font-medium text-ink">Nothing scheduled.</p>
              <p className="mt-0.5 text-sm text-ink-soft">DONE will surface the next move as soon as one appears.</p>
              <Link href="/content" className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(0,147,146,0.8)]" style={{ background: "var(--grad-brand)" }}>
                Create content <IconArrow className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ol className="space-y-3">
              {next.map((item, i) => (
                <li key={item.title}>
                  <Link href={item.href} className="flex items-start gap-3 rounded-xl border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-surface">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium leading-snug text-ink">{item.title}</span>
                      <span className="mt-0.5 block text-sm text-ink-soft">{item.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  amber: "text-amber-600",
  brand: "text-brand",
  emerald: "text-emerald-600",
  muted: "text-muted",
};

function StateCell({
  Icon, label, value, note, href, tone,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  label: string; value: string; note: string; href: string; tone: keyof typeof TONE;
}) {
  return (
    <Link href={href} className="group flex flex-col gap-1 p-4 transition-colors hover:bg-surface first:rounded-l-2xl last:rounded-r-2xl">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className={`text-2xl font-semibold tracking-tight ${TONE[tone]}`}>{value}</span>
      <span className="truncate text-xs text-muted">{note}</span>
    </Link>
  );
}
