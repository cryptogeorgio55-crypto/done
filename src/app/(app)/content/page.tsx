import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { GenerateAction } from "@/components/generate-action";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui";

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
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Content</h1>
        <p className="mt-1 text-ink-soft">Create posts, captions and Reels tailored to your brand.</p>
      </header>

      <GenerateAction path="/api/content" label="Create content" contentTypes={CONTENT_TYPES} />

      {items.length === 0 ? (
        <div className="card p-8 text-center text-ink-soft">No content yet. Create your first piece above.</div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.title || item.type}</span>
                  <Badge tone="gray">{item.status}</Badge>
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
