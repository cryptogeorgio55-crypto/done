import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ok, fail } from "@/lib/http";
import { requireUser, destroyCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

const schema = z.object({ confirm: z.string() });

export const POST = handle(async (req) => {
  const user = await requireUser();
  const { confirm } = schema.parse(await req.json().catch(() => ({})));
  if (confirm !== "DELETE") {
    return fail("confirmation_required", 'Type DELETE to confirm account removal.', 400);
  }

  // Delete workspaces the user owns (cascades to all workspace data), then the
  // user (cascades memberships & sessions). Explicit and irreversible.
  await db.$transaction(async (tx) => {
    await tx.workspace.deleteMany({ where: { ownerId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });

  await audit({ action: "account.deleted", metadata: { userId: user.id }, ip: clientIp(req) });
  await destroyCurrentSession();
  return ok({ redirect: "/" });
});
