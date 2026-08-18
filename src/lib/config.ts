// Centralized, validated runtime configuration. Reading env vars anywhere else
// in the app is discouraged — import from here so we have one source of truth.

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    // In development we warn rather than crash so the app can boot.
    console.warn(`[config] Missing env ${name} — using an insecure dev default.`);
    return "";
  }
  return value;
}

export const config = {
  appUrl: process.env.APP_URL || "http://localhost:3000",
  isProd: process.env.NODE_ENV === "production",
  sessionSecret:
    required("SESSION_SECRET", process.env.SESSION_SECRET) ||
    "insecure-dev-session-secret-do-not-use-in-production",
  platformAdminEmail: (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim(),
  // Dedicated key for encrypting secrets at rest (OAuth tokens). Falls back to
  // the session secret in dev; set a distinct value in production.
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    // Redirect base; the per-provider callback path is appended.
    redirectBase: process.env.GOOGLE_REDIRECT_BASE || process.env.APP_URL || "http://localhost:3000",
  },
  ai: {
    forcedProvider: process.env.AI_PROVIDER || "",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 45_000),
    maxRetries: Number(process.env.AI_MAX_RETRIES || 1),
    // DeepSeek is the production provider. DONE owns this account — customers
    // never supply their own key. OpenAI-compatible API; two real models today:
    // deepseek-chat (V3, fast+primary) and deepseek-reasoner (R1, reasoning).
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      fastModel: process.env.DEEPSEEK_FAST_MODEL || "deepseek-chat",
      primaryModel: process.env.DEEPSEEK_PRIMARY_MODEL || "deepseek-chat",
      reasoningModel: process.env.DEEPSEEK_REASONING_MODEL || "deepseek-reasoner",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || "",
      model: process.env.OLLAMA_MODEL || "llama3.1",
    },
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || "console",
    from: process.env.EMAIL_FROM || "DONE <no-reply@done.app>",
    resendApiKey: process.env.RESEND_API_KEY || "",
  },
} as const;

/** True when real Google OAuth credentials are configured. */
export function googleOAuthConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

/** True when a real (non-offline) AI provider is configured. */
export function aiConfigured(): boolean {
  return resolveAiProvider() !== "offline";
}

/** True when a dedicated encryption key (not the session-secret fallback) is set. */
export function encryptionKeyConfigured(): boolean {
  return Boolean(config.encryptionKey);
}

export interface SubsystemStatus {
  key: string;
  label: string;
  /** "ok" = configured/healthy, "missing" = not configured, "n/a" = not part of this build. */
  state: "ok" | "missing" | "n/a";
  required: "prod" | "optional" | "feature";
  detail: string;
}

/**
 * Single source of truth for "is this subsystem configured?" — consumed by the
 * admin System page and the startup summary. NEVER returns secret values.
 */
export function configStatus(): SubsystemStatus[] {
  const prod = config.isProd;
  const localhost = /localhost|127\.0\.0\.1/.test(config.appUrl);
  const https = config.appUrl.startsWith("https://");
  return [
    { key: "app_url", label: "Application URL", state: config.appUrl && !(prod && localhost) ? "ok" : "missing", required: "prod",
      detail: prod && localhost ? "APP_URL points at localhost in production" : config.appUrl },
    { key: "https", label: "HTTPS", state: !prod || https ? "ok" : "missing", required: "prod",
      detail: https ? "enabled" : prod ? "APP_URL is not https://" : "not required in development" },
    { key: "database", label: "Database", state: process.env.DATABASE_URL ? "ok" : "missing", required: "prod",
      detail: process.env.DATABASE_URL ? "DATABASE_URL set" : "DATABASE_URL missing" },
    { key: "session", label: "Session secret", state: config.sessionSecret && !config.sessionSecret.startsWith("insecure-") ? "ok" : "missing", required: "prod",
      detail: config.sessionSecret.startsWith("insecure-") ? "using insecure dev default" : "set" },
    { key: "encryption", label: "Token encryption key", state: encryptionKeyConfigured() ? "ok" : prod ? "missing" : "n/a", required: "prod",
      detail: encryptionKeyConfigured() ? "dedicated key set" : "falls back to SESSION_SECRET (set ENCRYPTION_KEY for prod)" },
    { key: "ai", label: "AI provider", state: aiConfigured() ? "ok" : "missing", required: "prod",
      detail: aiConfigured() ? `${resolveAiProvider()} configured` : "no key — running in offline fallback" },
    { key: "google", label: "Google OAuth (Gmail/Calendar)", state: googleOAuthConfigured() ? "ok" : "missing", required: "prod",
      detail: googleOAuthConfigured() ? "client id + secret set" : "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing" },
    { key: "admin", label: "Platform admin email", state: config.platformAdminEmail ? "ok" : "missing", required: "optional",
      detail: config.platformAdminEmail ? "set" : "optional bootstrap helper" },
    { key: "billing", label: "Billing (payments)", state: "n/a", required: "feature",
      detail: "plans & entitlements are enforced; Stripe payment wiring is not part of this build" },
    { key: "email", label: "Transactional email", state: "n/a", required: "feature",
      detail: "not wired in this build (customer email flows use the connected Gmail account)" },
  ];
}

export type AiProvider = "deepseek" | "anthropic" | "openai" | "ollama" | "offline";

/**
 * Which AI provider will actually be used, given current configuration.
 * DeepSeek is the production default and is preferred whenever its key is set.
 * The others remain as portable fallbacks so DONE is never locked to one vendor.
 */
export function resolveAiProvider(): AiProvider {
  const forced = config.ai.forcedProvider;
  if (
    forced === "deepseek" || forced === "anthropic" || forced === "openai" ||
    forced === "ollama" || forced === "offline"
  ) {
    return forced;
  }
  if (config.ai.deepseek.apiKey) return "deepseek";
  if (config.ai.anthropic.apiKey) return "anthropic";
  if (config.ai.openai.apiKey) return "openai";
  if (config.ai.ollama.baseUrl) return "ollama";
  return "offline";
}
