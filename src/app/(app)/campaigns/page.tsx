import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { GenerateAction } from "@/components/generate-action";
import { CopyButton } from "@/components/copy-button";
import { Badge, PageHeader, EmptyState, StatusChip } from "@/components/ui";
import { IconCustomers } from "@/components/icons";

const ASSET_LABELS: Record<string, string> = {
  instagram_post: "Instagram post",
  caption: "Caption",
  story: "Story",
  reel: "Reel",
  whatsapp: "WhatsApp / DM",
  sales_message: "Sales message",
  followup: "Follow-up",
  cta: "Call to action",
  ad: "Ad",
  checklist: "Checklist",
};

export default async function CampaignsPage() {
  const ctx = await requireWorkspaceContext();
  const campaigns = await db.campaign.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { assets: { orderBy: { position: "asc" } } },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Get customers" title="Launch your next campaign." subtitle="Tell DONE what you want. It builds the whole thing — strategy, offer and every asset." />

      <GenerateAction path="/api/campaigns" label="Create a campaign" withObjective />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<IconCustomers className="h-6 w-6" />}
          title="No campaigns yet."
          body="Want me to build the first one? Describe a goal above, or execute a reactivation Next Move from Today."
        />
      ) : (
        <div className="space-y-5">
          {campaigns.map((c) => (
            <div key={c.id} className="card card-hover p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{c.title}</h2>
                <div className="flex items-center gap-2">
                  {c.source === "lazy" ? <Badge tone="brand">Auto</Badge> : null}
                  <StatusChip status={c.status} />
                </div>
              </div>
              {c.objective ? <p className="mt-1 text-sm text-ink-soft">{c.objective}</p> : null}
              {c.offer ? (
                <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand">Offer: {c.offer}</p>
              ) : null}

              {/* Storyboard — the campaign flow at a glance */}
              {c.assets.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {c.assets.map((a, i) => (
                    <span key={a.id} className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/60 px-2.5 py-1.5 text-xs font-medium text-ink">
                        <span className="tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                        {ASSET_LABELS[a.kind] || a.kind}
                      </span>
                      {i < c.assets.length - 1 ? <span className="text-line-strong">→</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {c.assets.map((a) => (
                  <div key={a.id} className="rounded-xl border border-line p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {ASSET_LABELS[a.kind] || a.kind}
                      </span>
                      <CopyButton text={a.body} />
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-ink">{a.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
