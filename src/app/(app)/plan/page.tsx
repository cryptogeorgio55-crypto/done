import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { GenerateAction } from "@/components/generate-action";
import type { WeekPlanOutput } from "@/lib/ai/schemas";

export default async function PlanPage() {
  const ctx = await requireWorkspaceContext();
  const latest = await db.aiGeneration.findFirst({
    where: { workspaceId: ctx.workspace.id, kind: "plan" },
    orderBy: { createdAt: "desc" },
  });
  const plan = latest?.output as WeekPlanOutput | undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Plan My Week</h1>
        <p className="mt-1 text-ink-soft">A realistic weekly plan a busy owner can actually do.</p>
      </header>

      <GenerateAction path="/api/plan" label="Plan my week" />

      {plan?.days?.length ? (
        <div className="space-y-4">
          <p className="text-ink-soft">{plan.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.days.map((d, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{d.day}</span>
                  <span className="text-sm text-muted">{d.focus}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                  {d.tasks.map((t, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-brand">•</span> {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center text-ink-soft">
          No plan yet. Generate this week&apos;s plan above.
        </div>
      )}
    </div>
  );
}
