import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { generateToken, hashToken, sign, unsign } from "@/lib/crypto";

export const SESSION_COOKIE = "done_session";
const SESSION_TTL_DAYS = 30;

/**
 * Create a DB-backed session and set a signed, http-only cookie.
 * The raw token is never persisted — only its sha-256 hash.
 */
export async function createSession(
  userId: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<void> {
  const raw = generateToken(32);
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      userAgent: meta?.userAgent?.slice(0, 300),
      ip: meta?.ip,
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, sign(raw), {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolve the current session + user from the request cookie, or null. */
export async function getSessionUser() {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  const raw = unsign(cookie);
  if (!raw) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (session.user.deletedAt) return null;

  return { session, user: session.user };
}

/** Revoke the current session (logout) and clear the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (cookie) {
    const raw = unsign(cookie);
    if (raw) {
      await db.session
        .updateMany({
          where: { tokenHash: hashToken(raw) },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});
    }
  }
  jar.delete(SESSION_COOKIE);
}

/** Revoke every active session for a user (e.g. password reset). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
