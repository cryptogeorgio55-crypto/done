import { z } from "zod";
import { cookies } from "next/headers";
import { handle, ok } from "@/lib/http";
import { requireWorkspaceContext, requireRole } from "@/lib/workspace/context";
import { googleOAuthConfigured } from "@/lib/config";
import { buildGoogleAuthUrl } from "@/lib/connectors/google-oauth";
import { AppError } from "@/lib/errors";

const bodySchema = z.object({ provider: z.enum(["gmail", "google_calendar", "google_drive"]) });

// Begin the Google OAuth flow. Returns the authorize URL and stores the signed
// PKCE/state in httpOnly cookies. If OAuth isn't configured, the client should
// fall back to sandbox mode (nothing is faked as a real connection).
export const POST = handle(async (req) => {
  const ctx = await requireWorkspaceContext();
  requireRole(ctx, "admin");
  const { provider } = bodySchema.parse(await req.json().catch(() => ({})));

  if (!googleOAuthConfigured()) {
    throw new AppError("oauth_unconfigured", "Google isn't set up on this server yet. Use sandbox mode to try it out.", 400);
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
