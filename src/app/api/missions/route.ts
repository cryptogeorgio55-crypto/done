import { z } from "zod";
import { handle, ok, fail } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { runCoordinator } from "@/lib/agents/coordinator";
import { createMissionFromProposal } from "@/lib/missions/engine";
import { db } from "@/lib/db";

/** GET /api/missions — list missions with step progress. */
export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const missions = await db.mission.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { lastActiveAt: "desc" }],
    include: { steps: { orderBy: { seq: "asc" } } },
    take: 50,
  });
  return ok({
    missions: missions.map((m) => ({
      id: m.id, title: m.title, objective: m.objective, kind: m.kind,
      status: m.status, autonomy: m.autonomy, origin: m.origin,
      steps: m.steps.map((s) => ({
        id: s.id, seq: s.seq, title: s.title, kind: s.kind,
        status: s.status, requiresApproval: s.requiresApproval,
      })),
    })),
  });
});

const CreateBody = z.object({
  /** Create a mission from a ranked coordinator proposal (by its move id). */
  proposalId: z.string(),
  autonomy: z.enum(["observe", "suggest", "prepare", "auto"]).optional(),
});

/**
 * POST /api/missions — launch a durable Mission from a current proposal. We
 * re-run the coordinator server-side and match the requested proposal id, so
 * the client can't inject an arbitrary action; the mission is always grounded
 * in a real, freshly-computed recommendation.
 */
export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  const body = CreateBody.parse(await req.json());

  const { proposals } = await runCoordinator(ctx);
  const match = proposals.find((p) => `${p.agent}:${p.subject?.id ?? p.kind}` === body.proposalId);
  if (!match) return fail("not_found", "That recommendation is no longer current. Refresh and try again.", 404);

  // Avoid duplicate active missions for the same subject/kind.
  if (match.subject) {
    const existing = await db.mission.findFirst({
      where: {
        workspaceId: ctx.workspace.id,
        subjectType: match.subject.type,
        subjectId: match.subject.id,
        status: { in: ["active", "waiting_approval", "blocked"] },
      },
    });
    if (existing) return ok({ missionId: existing.id, reused: true });
  }

  const mission = await createMissionFromProposal(ctx, match, {
    autonomy: body.autonomy,
    origin: "next_move",
  });
  return ok({ missionId: mission.id, mission });
});
