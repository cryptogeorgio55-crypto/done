import Link from "next/link";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { getUsageSnapshot } from "@/lib/usage";
import { LazyHero } from "@/components/lazy/lazy-hero";
import { Metric } from "@/components/ui";
import {
  IconCustomers, IconContent, IconReplies, IconLeads, IconToday, IconSparkle, IconArrow,
} from "@/components/icons";

const ACTIONS = [
  { title: "Get Customers", desc: "Build an acquisition campaign", href: "/campaigns", Icon: IconCustomers },
  { title: "Create Content", desc: "Today's recommended post", href: "/content", Icon: IconContent },
  { title: "Reply to a customer", desc: "Paste a message, get the answer", href: "/replies", Icon: IconReplies },
  { title: "Follow up a lead", desc: "A personal, timely nudge", href: "/leads", Icon: IconLeads },
  { title: "Plan my week", desc: "A realistic weekly plan", href: "/plan", Icon: IconToday },
  { title: "Create an offer", desc: "A promotion from what you sell", href: "/campaigns", Icon: IconSparkle },
];

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const KIND_LABEL: Record<string, string> = {
  campaign: "Built a campaign",
  content: "Created content",
  reply: "Wrote a reply",
  followup: "Prepared a follow-up",
  plan: "Planned your week",
};

function dayBucket(d: Date) {
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ lazy?: string }>;
}) {
  const { lazy } = await searchParams;
  const ctx = await requireWorkspaceContext();
  const wsId = ctx.workspace.id;
  const now = new Date();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const [usage, followupCount, lastContent, recentGens, campaignCount] = await Promise.all([
    getUsageSnapshot(wsId),
    db.lead.count({ where: { workspaceId: wsId, deletedAt: null, stage: { notIn: ["won", "lost"] } } }),
    db.contentItem.findFirst({ where: { workspaceId: wsId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.aiGeneration.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, kind: true, createdAt: true } }),
    db.campaign.count({ where: { workspaceId: wsId, deletedAt: null } }),
  ]);

  const firstName = (ctx.user.name || "there").split(" ")[0];
  const staleContent = !lastContent || lastContent.createdAt < fiveDaysAgo;
  const daysSince = lastContent ? Math.floor((Date.now() - lastContent.createdAt.getTime()) / 86400000) : null;
  const weekendComing = [4, 5].includes(now.getUTCDay()); // Thu/Fri

  // Highest-priority recommendation from real signals.
  const rec =
    followupCount > 0
      ? { title: `${followupCount} ${followupCount === 1 ? "person is" : "people are"} waiting for a follow-up.`, cta: "Handle them", href: "/leads", tone: "urgent" as const }
      : staleContent
        ? { title: daysSince === null ? "You haven't posted anything yet." : `You haven't posted in ${daysSince} days.`, cta: "Fix that", href: "/content", tone: "urgent" as const }
        : weekendComing
          ? { title: "The weekend is coming. Want me to build an offer?", cta: "Let DONE handle it", href: "/dashboard?lazy=1", tone: "opportunity" as const }
          : { title: "Nothing urgent. You're good.", cta: "Create something anyway", href: "/content", tone: "calm" as const };

  const tasksThisMonth = usage.ai_generation;
  const hoursSaved = Math.max(1, Math.round((tasksThisMonth * 12) / 60));

  return (
    <div className="space-y-9">
      {/* Hero */}
      <section className="animate-slide-up">
        <p className="eyebrow">{greeting(now.getUTCHours())}, {firstName}</p>
        <h1 className="display mt-2">What do you want <span className="text-gradient">DONE?</span></h1>
        <p className="mt-3 max-w-xl text-lg text-ink-soft">Your business is ready. Pick something — or leave it to me.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <LazyHero autoStart={lazy === "1"} />

          {/* Quick actions */}
          <div className="stagger grid gap-3 sm:grid-cols-2">
            {ACTIONS.map((a, i) => (
              <Link key={a.title} href={a.href} className="card card-hover flex items-start gap-3.5 p-5" style={{ ["--i" as string]: i }}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-brand">
                  <a.Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{a.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{a.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          {/* Priority */}
          <div className={`card relative overflow-hidden p-6 ${rec.tone === "urgent" ? "" : ""}`}>
            {rec.tone !== "calm" ? <div className="orb -right-8 -top-10 h-28 w-28 bg-brand/25" /> : null}
            <p className="eyebrow relative">Today&apos;s priority</p>
            <p className="relative mt-2 text-lg font-semibold text-ink">{rec.title}</p>
            <Link href={rec.href} className="relative mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-brand to-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.8)] hover:to-brand-700">
              {rec.cta} <IconArrow className="h-4 w-4" />
            </Link>
          </div>

          {/* Daily brief */}
          <div className="card p-6">
            <p className="eyebrow">Your morning brief</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <BriefLine ok={followupCount === 0}>{followupCount > 0 ? `${followupCount} lead${followupCount === 1 ? "" : "s"} need attention` : "No leads waiting"}</BriefLine>
              <BriefLine ok={!staleContent}>{staleContent ? "Content is due for a refresh" : "Content is up to date"}</BriefLine>
              <BriefLine ok={campaignCount > 0}>{campaignCount > 0 ? `${campaignCount} campaign${campaignCount === 1 ? "" : "s"} running` : "No campaigns yet"}</BriefLine>
            </ul>
          </div>

          {/* Outcome metrics */}
          <div className="card p-6">
            <p className="eyebrow">DONE this month</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Metric value={tasksThisMonth} label="pieces of work" />
              <Metric value={usage.campaign} label="campaigns built" />
              <Metric value={usage.lazy_run} label="lazy runs" />
              <Metric value={`≈${hoursSaved}h`} label="saved" hint="estimate" />
            </div>
          </div>

          {/* Activity timeline */}
          {recentGens.length > 0 ? (
            <div className="card p-6">
              <p className="eyebrow">What DONE has done</p>
              <ol className="mt-3 space-y-3">
                {recentGens.map((g) => (
                  <li key={g.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span className="flex-1">
                      <span className="text-ink">{KIND_LABEL[g.kind] || "Did something useful"}</span>
                      <span className="ml-2 text-xs text-muted">{dayBucket(g.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function BriefLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      {children}
    </li>
  );
}
