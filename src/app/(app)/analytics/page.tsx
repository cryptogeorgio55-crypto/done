import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { getUsageSnapshot } from "@/lib/usage";
import { PageHeader, Metric, Card } from "@/components/ui";

const STAGES = ["new", "contacted", "interested", "followup", "won", "lost"];

export default async function AnalyticsPage() {
  const ctx = await requireWorkspaceContext();
  const wsId = ctx.workspace.id;

  const [usage, leads, followupsPrepared] = await Promise.all([
    getUsageSnapshot(wsId),
    db.lead.groupBy({ by: ["stage"], where: { workspaceId: wsId, deletedAt: null }, _count: true }),
    db.aiGeneration.count({ where: { workspaceId: wsId, kind: "followup" } }),
  ]);

  const leadByStage: Record<string, number> = {};
  for (const s of STAGES) leadByStage[s] = 0;
  for (const row of leads) leadByStage[row.stage] = row._count;
  const totalLeads = Object.values(leadByStage).reduce((a, b) => a + b, 0);
  const hoursSaved = Math.max(1, Math.round((usage.ai_generation * 12) / 60));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Analytics" title="The work DONE handled" subtitle="Outcome over vanity metrics. Here's what actually got done this month." />

      <Card className="p-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <Metric value={usage.ai_generation} label="pieces of work created" />
          <Metric value={followupsPrepared} label="follow-ups prepared" />
          <Metric value={usage.campaign} label="campaigns built" />
          <Metric value={`≈${hoursSaved}h`} label="potentially saved" hint="estimate" />
        </div>
      </Card>

      <Card className="p-6">
        <p className="eyebrow">Leads by stage</p>
        {totalLeads === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No leads yet — add some in Follow Ups and they&apos;ll appear here.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {STAGES.map((stage) => {
              const count = leadByStage[stage];
              const pct = totalLeads ? Math.round((count / totalLeads) * 100) : 0;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-24 text-sm capitalize text-ink-soft">{stage}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand to-cyan transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-ink">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
