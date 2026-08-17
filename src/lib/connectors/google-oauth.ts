import { randomBytes, createHash } from "crypto";
import { config, googleOAuthConfigured } from "@/lib/config";
import { db } from "@/lib/db";
import { encryptSecret, tryDecryptSecret, sign, unsign } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

// Production-grade Google OAuth: authorization-code + PKCE, signed/HMAC'd state
// to defeat CSRF, encrypted token storage, and transparent refresh. Provider
// tokens NEVER reach the frontend and are stored only as ciphertext.

const SCOPES: Record<string, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
  google_calendar: ["https://www.googleapis.com/auth/calendar.events"],
  google_drive: ["https://www.googleapis.com/auth/drive.readonly"],
};

export function googleScopesFor(provider: string): string[] {
  return SCOPES[provider] ?? [];
}

export interface OAuthStart {
  authorizeUrl: string;
  /** Opaque value the caller sets as an httpOnly cookie and verifies on callback. */
  stateCookie: string;
  codeVerifier: string;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Build the Google authorization URL for a provider connection. */
export function buildGoogleAuthUrl(opts: {
  provider: string;
  workspaceId: string;
}): OAuthStart {
  if (!googleOAuthConfigured()) {
    throw new AppError("oauth_unconfigured", "Google OAuth is not configured on this server.", 400);
  }
  const scopes = googleScopesFor(opts.provider);
  if (!scopes.length) throw new AppError("oauth_unsupported", "Unsupported provider.", 400);

  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const nonce = base64url(randomBytes(16));

  // State binds provider+workspace+nonce+verifier and is HMAC-signed so the
  // callback can trust it without server-side session storage.
  const statePayload = JSON.stringify({
    p: opts.provider,
    w: opts.workspaceId,
    n: nonce,
    v: codeVerifier,
  });
  const stateCookie = sign(Buffer.from(statePayload).toString("base64url"));
  const state = nonce; // only the nonce travels through Google; the rest stays in the cookie

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${config.google.redirectBase}/api/integrations/google/callback`,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return {
    authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    stateCookie,
    codeVerifier,
  };
}

export interface VerifiedState {
  provider: string;
  workspaceId: string;
  nonce: string;
  codeVerifier: string;
}

/** Verify the signed state cookie and that its nonce matches Google's `state`. */
export function verifyGoogleState(stateCookie: string, returnedState: string): VerifiedState {
  const unsigned = unsign(stateCookie);
  if (!unsigned) throw new AppError("oauth_state_invalid", "Invalid OAuth state.", 400);
  let parsed: { p: string; w: string; n: string; v: string };
  try {
    parsed = JSON.parse(Buffer.from(unsigned, "base64url").toString("utf8"));
  } catch {
    throw new AppError("oauth_state_invalid", "Invalid OAuth state.", 400);
  }
  if (!parsed.n || parsed.n !== returnedState) {
    throw new AppError("oauth_state_mismatch", "OAuth state mismatch — possible CSRF.", 400);
  }
  return { provider: parsed.p, workspaceId: parsed.w, nonce: parsed.n, codeVerifier: parsed.v };
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

/** Exchange an authorization code for tokens. */
export async function exchangeGoogleCode(opts: {
  code: string;
  codeVerifier: string;
}): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      code: opts.code,
      code_verifier: opts.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: `${config.google.redirectBase}/api/integrations/google/callback`,
    }),
  });
  if (!res.ok) throw new AppError("oauth_exchange_failed", "Could not complete Google sign-in.", 502);
  return (await res.json()) as GoogleTokenResponse;
}

/** Persist tokens (encrypted) for an account. */
export async function storeGoogleTokens(accountId: string, tok: GoogleTokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000);
  await db.oAuthToken.upsert({
    where: { accountId },
    create: {
      accountId,
      accessTokenEnc: encryptSecret(tok.access_token),
      refreshTokenEnc: tok.refresh_token ? encryptSecret(tok.refresh_token) : null,
      tokenType: tok.token_type ?? "Bearer",
      scope: tok.scope,
      expiresAt,
    },
    update: {
      accessTokenEnc: encryptSecret(tok.access_token),
      // Google only returns refresh_token on first consent — keep the old one otherwise.
      ...(tok.refresh_token ? { refreshTokenEnc: encryptSecret(tok.refresh_token) } : {}),
      tokenType: tok.token_type ?? "Bearer",
      scope: tok.scope,
      expiresAt,
    },
  });
}

/**
 * Return a valid access token for an account, refreshing if it is expired or
 * about to expire. Throws (needs reconnect) if refresh is impossible.
 */
export async function getValidGoogleAccessToken(accountId: string): Promise<string> {
  const token = await db.oAuthToken.findUnique({ where: { accountId } });
  if (!token) throw new AppError("not_connected", "This account is not connected.", 409);

  const skewMs = 60_000;
  const stillValid = token.expiresAt && token.expiresAt.getTime() - Date.now() > skewMs;
  const access = tryDecryptSecret(token.accessTokenEnc);
  if (stillValid && access) return access;

  const refresh = tryDecryptSecret(token.refreshTokenEnc);
  if (!refresh) throw new AppError("reconnect_required", "Reconnect this account to continue.", 409);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new AppError("reconnect_required", "Reconnect this account to continue.", 409);
  const refreshed = (await res.json()) as GoogleTokenResponse;
  await storeGoogleTokens(accountId, { ...refreshed, refresh_token: refreshed.refresh_token });
  return refreshed.access_token;
}
