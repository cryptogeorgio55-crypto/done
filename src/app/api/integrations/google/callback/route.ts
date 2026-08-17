import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { config } from "@/lib/config";
import { audit } from "@/lib/audit";
import {
  verifyGoogleState,
  exchangeGoogleCode,
  storeGoogleTokens,
  googleScopesFor,
} from "@/lib/connectors/google-oauth";

// OAuth redirect handler. Verifies state (CSRF), exchanges the code for tokens,
// stores them ENCRYPTED, and marks the account connected. Tokens never reach the
// browser. On any failure we redirect back with a friendly error.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (err?: string) =>
    NextResponse.redirect(`${config.appUrl}/connections${err ? `?error=${encodeURIComponent(err)}` : "?connected=1"}`);

  try {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    if (oauthError) return back(oauthError);
    if (!code || !state) return back("missing_code");

    const jar = await cookies();
    const stateCookie = jar.get("done_oauth_state")?.value;
    const pkce = jar.get("done_oauth_pkce")?.value;
    if (!stateCookie || !pkce) return back("expired");

    const verified = verifyGoogleState(stateCookie, state);

    // Re-establish the workspace context and ensure the state's workspace matches.
    const ctx = await requireWorkspaceContext(verified.workspaceId);

    const tokens = await exchangeGoogleCode({ code, codeVerifier: pkce });

    const account = await db.integrationAccount.upsert({
      where: { workspaceId_provider: { workspaceId: ctx.workspace.id, provider: verified.provider } },
      create: {
        workspaceId: ctx.workspace.id,
        provider: verified.provider,
        mode: "oauth",
        status: "connected",
        health: "ok",
        scopes: googleScopesFor(verified.provider),
        connectedAt: new Date(),
        config: { mode: "oauth" },
      },
      update: { mode: "oauth", status: "connected", health: "ok", connectedAt: new Date(), config: { mode: "oauth" } },
    });
    await storeGoogleTokens(account.id, tokens);

    // Clear one-time cookies.
    jar.delete("done_oauth_state");
    jar.delete("done_oauth_pkce");

    await audit({
      action: "integration.connected",
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      targetType: "integration",
      targetId: account.id,
      metadata: { provider: verified.provider, mode: "oauth" },
    });
    return back();
  } catch (err) {
    console.error("[oauth/callback]", err);
    return back("connection_failed");
  }
}
