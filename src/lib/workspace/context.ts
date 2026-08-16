import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const ACTIVE_WORKSPACE_COOKIE = "done_ws";

export type Role = "owner" | "admin" | "member";

export interface WorkspaceContext {
  user: Awaited<ReturnType<typeof requireUser>>;
  workspace: NonNullable<Awaited<ReturnType<typeof db.workspace.findUnique>>>;
  membership: NonNullable<Awaited<ReturnType<typeof db.membership.findFirst>>>;
  role: Role;
}

/**
 * The single choke point for tenant isolation.
 *
 * Resolves the authenticated user, determines the active workspace, and
 * verifies — server-side, against the database — that the user is actually a
 * member of it. Every workspace-scoped route MUST obtain its workspaceId from
 * here and never trust an id supplied by the client for authorization.
 */
export async function requireWorkspaceContext(
  preferredWorkspaceId?: string
): Promise<WorkspaceContext> {
  const user = await requireUser();

  const jar = await cookies();
  const cookieWsId = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const targetId = preferredWorkspaceId || cookieWsId;

  // Find a membership. If a specific workspace was requested, it must match a
  // membership for THIS user — otherwise it's a cross-tenant access attempt.
  const membership = targetId
    ? await db.membership.findFirst({
        where: { userId: user.id, workspaceId: targetId },
        include: { workspace: true },
      })
    : await db.membership.findFirst({
        where: { userId: user.id, workspace: { deletedAt: null } },
        orderBy: { createdAt: "asc" },
        include: { workspace: true },
      });

  if (!membership) {
    if (targetId) throw new ForbiddenError("You don't have access to this workspace.");
    throw new NotFoundError("No workspace found for your account.");
  }
  if (membership.workspace.deletedAt) {
    throw new NotFoundError("This workspace has been deleted.");
  }

  return {
    user,
    workspace: membership.workspace,
    membership,
    role: membership.role as Role,
  };
}

const ROLE_RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

/** Assert the current context has at least the given role. */
export function requireRole(ctx: WorkspaceContext, min: Role): void {
  if (ROLE_RANK[ctx.role] < ROLE_RANK[min]) {
    throw new ForbiddenError(`This action requires ${min} permissions.`);
  }
}

/** List all workspaces the user can access (for a workspace switcher). */
export async function listUserWorkspaces(userId: string) {
  const memberships = await db.membership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role as Role }));
}
