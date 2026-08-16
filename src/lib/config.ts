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
  ai: {
    forcedProvider: process.env.AI_PROVIDER || "",
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

/** Which AI provider will actually be used, given current configuration. */
export function resolveAiProvider(): "anthropic" | "openai" | "ollama" | "offline" {
  const forced = config.ai.forcedProvider;
  if (forced === "anthropic" || forced === "openai" || forced === "ollama" || forced === "offline") {
    return forced;
  }
  if (config.ai.anthropic.apiKey) return "anthropic";
  if (config.ai.openai.apiKey) return "openai";
  if (config.ai.ollama.baseUrl) return "ollama";
  return "offline";
}
