import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { GenerateAction } from "@/components/generate-action";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui";

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
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Get Customers</h1>
        <p className="mt-1 text-ink-soft">Generate a complete campaign with every asset you need.</p>
      </header>

      <GenerateAction path="/api/campaigns" label="Create a campaign" withObjective />

      {campaigns.length === 0 ? (
        <div className="card p-8 text-center text-ink-soft">
          No campaigns yet. Generate your first one above — or press I&apos;M LAZY on the dashboard.
        </div>
      ) : (
        <div className="space-y-5">
          {campaigns.map((c) => (
            <div key={c.id} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{c.title}</h2>
                <div className="flex items-center gap-2">
                  {c.source === "lazy" ? <Badge tone="brand">I&apos;M LAZY</Badge> : null}
                  <Badge tone="gray">{c.status}</Badge>
                </div>
              </div>
              {c.objective ? <p className="mt-1 text-sm text-ink-soft">{c.objective}</p> : null}
              {c.offer ? (
                <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-brand">Offer: {c.offer}</p>
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
