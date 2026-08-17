import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { GenerateAction } from "@/components/generate-action";
import { CopyButton } from "@/components/copy-button";
import { PageHeader, EmptyState, StatusChip } from "@/components/ui";
import { IconContent } from "@/components/icons";

const CONTENT_TYPES = [
  { value: "instagram_post", label: "Instagram post" },
  { value: "promotional_post", label: "Promotional post" },
  { value: "educational", label: "Educational post" },
  { value: "testimonial", label: "Testimonial post" },
  { value: "reel_idea", label: "Reel idea" },
];

export default async function ContentPage() {
  const ctx = await requireWorkspaceContext();
  const items = await db.contentItem.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  // Proactive recommendation from real posting cadence.
  const last = items[0];
  const daysSince = last ? Math.floor((Date.now() - last.createdAt.getTime()) / 86_400_000) : null;
  const weekend = [4, 5, 6].includes(new Date().getDay());
  const rec =
    daysSince === null
      ? { headline: "Let's get your first post out.", why: "You haven't posted anything yet — a simple welcome post is a great start." }
      : daysSince >= 4
        ? { headline: "You've gone quiet — post something today.", why: `It's been ${daysSince} days since your last post. Staying visible keeps customers warm.` }
        : weekend
          ? { headline: "Promote your weekend availability.", why: "The weekend is prime booking time and you have open capacity." }
          : { headline: "Keep the momentum going.", why: "You're posting consistently. Here's a fresh idea to build on it." };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content" title="What should we say today?" subtitle="Posts, captions and Reels — written in your brand voice, ready to publish." />

      {/* Proactive recommendation — DONE decides what's worth saying */}
      <div className="card relative overflow-hidden p-6">
        <div className="orb -right-8 -top-10 h-28 w-28 bg-brand/20" />
        <p className="eyebrow relative">DONE recommends</p>
        <p className="relative mt-2 text-xl font-semibold text-ink">{rec.headline}</p>
        <p className="relative mt-1 max-w-xl text-sm text-ink-soft">{rec.why}</p>
      </div>

      <GenerateAction path="/api/content" label="Create it" contentTypes={CONTENT_TYPES} />

      {items.length === 0 ? (
        <EmptyState
          icon={<IconContent className="h-6 w-6" />}
          title="Nothing here yet."
          body="Let's create something worth posting. Pick a type above and DONE writes it."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const social = ["instagram_post", "promotional_post", "testimonial", "educational"].includes(item.type);
            return (
              <div key={item.id} className="card card-hover overflow-hidden">
                {social ? (
                  // Instagram-style visual preview — not a plain text card.
                  <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand to-cyan text-xs font-bold text-white">
                      {(item.title || "D").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{item.title || "Your business"}</p>
                      <p className="text-[11px] text-muted">{item.type.replace(/_/g, " ")}</p>
                    </div>
                    <StatusChip status={item.status} />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 px-4 pt-4">
                    <span className="font-semibold">{item.title || item.type}</span>
                    <StatusChip status={item.status} />
                  </div>
                )}
                <div className="p-4">
                  <p className="whitespace-pre-wrap text-sm text-ink">{item.body}</p>
                  <div className="mt-3 flex justify-end"><CopyButton text={item.body} /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
