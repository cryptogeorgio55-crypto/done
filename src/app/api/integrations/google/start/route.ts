import { z } from "zod";
import { cookies } from "next/headers";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { googleOAuthConfigured } from "@/lib/config";
import { buildGoogleAuthUrl } from "@/lib/connectors/google-oauth";
import { AppError } from "@/lib/errors";

const bodySchema = z.object({ provider: z.enum(["gmail", "google_calendar", "google_drive"]) });

// Begin the Google OAuth flow. Returns the authorize URL and stores the signed
// PKCE/state in httpOnly cookies. Real connection only — if OAuth credentials
// aren't configured, we say so plainly (nothing is ever faked as connected).
export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const { provider } = bodySchema.parse(await req.json().catch(() => ({})));

  if (!googleOAuthConfigured()) {
    throw new AppError("oauth_unconfigured", "Google OAuth isn't configured on this server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect a real account.", 400);
  }

  const { authorizeUrl, stateCookie, codeVerifier } = buildGoogleAuthUrl({
    provider,
    workspaceId: ctx.workspace.id,
  });

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set("done_oauth_state", stateCookie, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  jar.set("done_oauth_pkce", codeVerifier, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });

  return ok({ authorizeUrl });
});
