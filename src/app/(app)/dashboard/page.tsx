import Link from "next/link";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import { getUsageSnapshot } from "@/lib/usage";
import { LazyButton } from "@/components/lazy-button";
import { Badge } from "@/components/ui";

const ACTIONS = [
  ["Get Customers", "Generate an acquisition campaign", "/campaigns"],
  ["Create Content", "Today's recommended post", "/content"],
  ["Create an Offer", "A promotion from what you sell", "/campaigns?objective=offer"],
  ["Reply to Customer", "Turn a message into the perfect reply", "/replies"],
  ["Follow Up a Lead", "Draft a personal follow-up", "/leads"],
  ["Plan My Week", "A realistic weekly plan", "/plan"],
];

export default async function DashboardPage() {
  const ctx = await requireWorkspaceContext();
  const wsId = ctx.workspace.id;

  const [usage, entitlements, followupCount, lastRun, recentCampaigns] = await Promise.all([
    getUsageSnapshot(wsId),
    getEntitlements(wsId),
    db.lead.count({
      where: { workspaceId: wsId, deletedAt: null, stage: { notIn: ["won", "lost"] } },
    }),
    db.lazyRun.findFirst({
      where: { workspaceId: wsId, status: "completed" },
      orderBy: { createdAt: "desc" },
    }),
    db.campaign.findMany({
      where: { workspaceId: wsId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const aiLimit = entitlements.aiGenerationsPerMonth;
  const firstName = ctx.user.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted">Welcome back, {firstName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">What do you want DONE?</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Lazy button */}
          <LazyButton />

          {/* Quick actions */}
          <div className="grid gap-3 sm:grid-cols-2">
            {ACTIONS.map(([title, desc, href]) => (
              <Link key={title} href={href} className="card group p-5 transition-shadow hover:shadow-md">
                <h3 className="font-semibold group-hover:text-brand">{title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Today panel */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-muted">Today</h3>
            {lastRun ? (
              <p className="mt-2 text-sm text-ink-soft">{lastRun.message}</p>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">
                Nothing urgent. You&apos;re good. Press I&apos;M LAZY to get started.
              </p>
            )}
            {followupCount > 0 ? (
              <div className="mt-3">
                <Link href="/leads" className="text-sm font-medium text-brand hover:underline">
                  {followupCount} lead{followupCount === 1 ? "" : "s"} to follow up →
                </Link>
              </div>
            ) : null}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted">This month</h3>
              <Badge tone="gray">{ctx.role}</Badge>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="AI generations" value={`${usage.ai_generation}${aiLimit === null ? "" : ` / ${aiLimit}`}`} />
              <Row label="Lazy runs" value={String(usage.lazy_run)} />
              <Row label="Campaigns" value={String(usage.campaign)} />
              <Row label="Content" value={String(usage.content)} />
            </dl>
          </div>

          {recentCampaigns.length > 0 ? (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-muted">Recent campaigns</h3>
              <ul className="mt-3 space-y-2">
                {recentCampaigns.map((c) => (
                  <li key={c.id}>
                    <Link href="/campaigns" className="text-sm text-ink hover:text-brand">
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
