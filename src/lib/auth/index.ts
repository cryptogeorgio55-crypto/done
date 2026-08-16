import { getSessionUser } from "./session";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

export { createSession, destroyCurrentSession, revokeAllSessions, getSessionUser } from "./session";
export { hashPassword, verifyPassword, validatePasswordStrength } from "./password";

/** Returns the signed-in user or null. Safe to call anywhere server-side. */
export async function getCurrentUser() {
  const result = await getSessionUser();
  return result?.user ?? null;
}

/** Returns the signed-in user or throws 401. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Requires an authenticated platform administrator. */
export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) {
    throw new ForbiddenError("Platform administrator access required.");
  }
  return user;
}
