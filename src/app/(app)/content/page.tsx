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

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content" title="Create something worth posting." subtitle="Posts, captions and Reels — written in your brand voice, ready to publish." />

      <GenerateAction path="/api/content" label="Create it" contentTypes={CONTENT_TYPES} />

      {items.length === 0 ? (
        <EmptyState
          icon={<IconContent className="h-6 w-6" />}
          title="Nothing here yet."
          body="Let's create something worth posting. Pick a type above and DONE writes it."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card card-hover p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.title || item.type}</span>
                  <StatusChip status={item.status} />
                </div>
                <CopyButton text={item.body} />
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{item.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
