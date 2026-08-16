import { db } from "@/lib/db";
import { currentPeriod } from "@/lib/usage";

export default async function AdminOverviewPage() {
  const period = currentPeriod();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalWorkspaces,
    activeSubs,
    trials,
    signups7d,
    activeUsers1d,
    aiThisMonth,
    lazyThisMonth,
    recentWorkspaces,
  ] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.workspace.count({ where: { deletedAt: null } }),
    db.subscription.count({ where: { status: "active" } }),
    db.subscription.count({ where: { status: "trialing" } }),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { lastLoginAt: { gte: dayAgo } } }),
    db.usageRecord.aggregate({ where: { metric: "ai_generation", period }, _sum: { count: true } }),
    db.usageRecord.aggregate({ where: { metric: "lazy_run", period }, _sum: { count: true } }),
    db.workspace.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { subscription: { include: { plan: true } }, businessProfile: true },
    }),
  ]);

  const stats = [
    ["Total users", totalUsers],
    ["Workspaces", totalWorkspaces],
    ["Active subscriptions", activeSubs],
    ["Trials", trials],
    ["Signups (7d)", signups7d],
    ["Active users (24h)", activeUsers1d],
    ["AI generations (month)", aiThisMonth._sum.count ?? 0],
    ["Lazy runs (month)", lazyThisMonth._sum.count ?? 0],
  ] as const;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3 text-sm font-semibold">Recent workspaces</div>
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-5 py-2 font-medium">Workspace</th>
              <th className="px-5 py-2 font-medium">Industry</th>
              <th className="px-5 py-2 font-medium">Plan</th>
              <th className="px-5 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {recentWorkspaces.map((w) => (
              <tr key={w.id} className="border-t border-line">
                <td className="px-5 py-2.5 font-medium">{w.name}</td>
                <td className="px-5 py-2.5 text-ink-soft">{w.businessProfile?.industryKey || "—"}</td>
                <td className="px-5 py-2.5 text-ink-soft">
                  {w.subscription?.plan?.name || "Free"} · {w.subscription?.status || "—"}
                </td>
                <td className="px-5 py-2.5 text-ink-soft">{w.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
