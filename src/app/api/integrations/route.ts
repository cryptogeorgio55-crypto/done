import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { listConnectorCatalog } from "@/lib/connectors/registry";
import { listAccounts, disconnect } from "@/lib/connectors/accounts";

export const GET = handle(async () => {
  const ctx = await requireWorkspaceContext();
  const [catalog, accounts] = await Promise.all([
    Promise.resolve(listConnectorCatalog()),
    listAccounts(ctx.workspace.id),
  ]);
  const byProvider = Object.fromEntries(accounts.map((a) => [a.provider, a]));
  const integrations = catalog.map((c) => ({ ...c, account: byProvider[c.key] ?? null }));
  return ok({ integrations });
});

const bodySchema = z.object({
  action: z.enum(["disconnect"]),
  provider: z.string().max(40),
});

// Connecting is done exclusively through real Google OAuth
// (see /api/integrations/google/start). This endpoint only disconnects.
export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const { provider } = bodySchema.parse(await req.json().catch(() => ({})));
  await disconnect(ctx, provider);
  return ok({ connected: false, provider });
});
