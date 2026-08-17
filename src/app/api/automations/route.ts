import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { rateLimit } from "@/lib/rate-limit";
import {
  listRules, toggleRule, recentRuns, parseAutomationNL, createAutomationFromSpec,
} from "@/lib/automations/rules";

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const [rules, runs] = await Promise.all([listRules(ctx.workspace.id), recentRuns(ctx.workspace.id)]);
  return ok({
    rules,
    runs: runs.map((r) => ({
      id: r.id, trigger: r.trigger, status: r.status, intent: r.intent, message: r.message,
      summary: r.summary, actionsDone: r.actionsDone, approvalsCount: r.approvalsCount,
      startedAt: r.startedAt, finishedAt: r.finishedAt, steps: r.steps.length,
    })),
  });
});

const postSchema = z.union([
  z.object({ action: z.literal("toggle"), id: z.string(), enabled: z.boolean() }),
  z.object({ action: z.literal("parse"), instruction: z.string().min(4).max(600) }),
  z.object({
    action: z.literal("create"),
    spec: z.object({
      name: z.string().max(120),
      trigger: z.enum(["email.received", "lead.followup_due", "calendar.event_starting", "schedule:morning"]),
      condition: z.string().max(300).default(""),
      actions: z.array(z.string().max(200)).max(6),
    }),
  }),
]);

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const body = postSchema.parse(await req.json().catch(() => ({})));

  if (body.action === "toggle") {
    const rule = await toggleRule(ctx.workspace.id, body.id, body.enabled);
    return ok({ rule });
  }
  if (body.action === "parse") {
    rateLimit(`automation-parse:${ctx.workspace.id}`, 10, 60_000);
    const { parsed, offline } = await parseAutomationNL(body.instruction);
    return ok({ parsed, offline });
  }
  const rule = await createAutomationFromSpec(ctx.workspace.id, body.spec);
  return ok({ rule }, 201);
});
