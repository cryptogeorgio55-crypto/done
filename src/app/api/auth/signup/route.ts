import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { handle, ok, fail } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validation";
import { hashPassword, validatePasswordStrength, createSession } from "@/lib/auth";
import { createWorkspaceForUser } from "@/lib/workspace/provision";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/context";
import { config } from "@/lib/config";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  rateLimit(`signup:${ip}`, 5, 60_000);

  const body = await req.json().catch(() => ({}));
  const input = signupSchema.parse(body);

  const pwError = validatePasswordStrength(input.password);
  if (pwError) return fail("weak_password", pwError, 422);

  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Avoid user enumeration: generic message, same status.
    return fail("email_taken", "That email can't be used. Try signing in instead.", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const isPlatformAdmin =
    !!config.platformAdminEmail && input.email === config.platformAdminEmail;

  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      isPlatformAdmin,
    },
  });

  const workspace = await createWorkspaceForUser(user.id, input.businessName || `${input.name}'s business`);

  await createSession(user.id, { userAgent: req.headers.get("user-agent") || undefined, ip });
  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  await audit({ action: "user.signup", actorId: user.id, workspaceId: workspace.id, ip });

  return ok({ redirect: "/onboarding" }, 201);
});
