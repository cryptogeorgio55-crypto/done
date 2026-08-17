import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { listConnectorCatalog } from "@/lib/connectors/registry";
import { listAccounts, connectSandbox, disconnect } from "@/lib/connectors/accounts";

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
  action: z.enum(["connect_sandbox", "disconnect"]),
  provider: z.string().max(40),
});

export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const { action, provider } = bodySchema.parse(await req.json().catch(() => ({})));
  if (action === "connect_sandbox") {
    const account = await connectSandbox(ctx, provider);
    return ok({ connected: true, provider, mode: account.mode });
  }
  await disconnect(ctx, provider);
  return ok({ connected: false, provider });
});
