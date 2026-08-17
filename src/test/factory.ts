import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";

/** Create an isolated workspace + owner and return a usable WorkspaceContext. */
export async function makeWorkspace(name = "Test Co"): Promise<WorkspaceContext> {
  const user = await db.user.create({
    data: { email: `${randomUUID()}@test.local`, passwordHash: "x", name: "Test Owner" },
  });
  const workspace = await db.workspace.create({
    data: { name, slug: `ws-${randomUUID().slice(0, 8)}`, ownerId: user.id, onboardedAt: new Date() },
  });
  const membership = await db.membership.create({
    data: { userId: user.id, workspaceId: workspace.id, role: "owner", acceptedAt: new Date() },
  });
  // Give the workspace a minimal Business Brain so context rendering has data.
  await db.businessProfile.create({
    data: { workspaceId: workspace.id, businessName: name, description: "We build websites." },
  });
  return {
    user: user as unknown as WorkspaceContext["user"],
    workspace,
    membership,
    role: "owner",
  };
}
