import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { rateLimit } from "@/lib/rate-limit";
import { executeApproval, rejectApproval } from "@/lib/tools/executor";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  // Optional edited payload the owner tweaked before approving.
  editedInput: z.record(z.string(), z.unknown()).optional(),
});

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  rateLimit(`approval:${ctx.workspace.id}`, 60, 60_000);
  const id = new URL(req.url).pathname.split("/").pop() as string;
  const { action, editedInput } = bodySchema.parse(await req.json().catch(() => ({})));

  if (action === "reject") {
    await rejectApproval(ctx, id);
    return ok({ status: "rejected" });
  }
  const outcome = await executeApproval(ctx, id, editedInput);
  return ok(outcome);
});
