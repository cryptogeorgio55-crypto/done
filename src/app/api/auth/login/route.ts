import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { handle, ok, fail } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, createSession } from "@/lib/auth";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/context";
import { config } from "@/lib/config";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  // Rate-limit by IP and by email to blunt brute-force / credential stuffing.
  rateLimit(`login:${ip}`, 10, 60_000);

  const body = await req.json().catch(() => ({}));
  const input = loginSchema.parse(body);
  rateLimit(`login:email:${input.email}`, 8, 60_000);

  const user = await db.user.findUnique({ where: { email: input.email } });
  // Constant-ish response regardless of whether the user exists.
  const valid = user && !user.deletedAt && (await verifyPassword(input.password, user.passwordHash));

  if (!user || !valid) {
    await audit({ action: "user.login_failed", ip, metadata: { email: input.email } });
    return fail("invalid_credentials", "Incorrect email or password.", 401);
  }

  await createSession(user.id, { userAgent: req.headers.get("user-agent") || undefined, ip });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  // Set active workspace to the user's first membership.
  const membership = await db.membership.findFirst({
    where: { userId: user.id, workspace: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
  });
  const jar = await cookies();
  if (membership) {
    jar.set(ACTIVE_WORKSPACE_COOKIE, membership.workspaceId, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  await audit({ action: "user.login", actorId: user.id, ip });

  const workspace = membership
    ? await db.workspace.findUnique({ where: { id: membership.workspaceId } })
    : null;
  const redirect = workspace?.onboardedAt ? "/dashboard" : "/onboarding";
  return ok({ redirect });
});
