// Shared helpers for the ops scripts. Zero dependencies.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load a .env file into process.env (does not overwrite already-set vars). */
export function loadEnv(file = ".env") {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const INSECURE_DEFAULTS = new Set([
  "change-me-to-a-long-random-string",
  "insecure-dev-session-secret-do-not-use-in-production",
  "",
]);

/**
 * Build the production readiness checklist purely from process.env.
 * status: "pass" | "fail" | "warn"
 */
export function buildChecks() {
  const env = process.env;
  const appUrl = env.APP_URL || "";
  const isProd = (env.NODE_ENV || "").toLowerCase() === "production";
  const localhost = /localhost|127\.0\.0\.1/.test(appUrl);
  const https = appUrl.startsWith("https://");
  const provider = (env.AI_PROVIDER || "").toLowerCase();
  const aiConfigured =
    provider === "offline"
      ? false
      : Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.OLLAMA_BASE_URL);
  const sqlite = (env.DATABASE_URL || "").startsWith("file:");

  const strongSecret = (v) => Boolean(v) && !INSECURE_DEFAULTS.has(v) && v.length >= 16;

  const checks = [];
  const add = (label, status, detail) => checks.push({ label, status, detail });

  add("Application URL", appUrl ? "pass" : "fail", appUrl || "APP_URL is not set");
  if (isProd && localhost) add("APP_URL is not localhost", "fail", "APP_URL points at localhost in production");
  if (isProd) add("HTTPS", https ? "pass" : "fail", https ? "enabled" : "APP_URL must be https:// in production");

  add("Database URL", env.DATABASE_URL ? "pass" : "fail", env.DATABASE_URL ? (sqlite ? "SQLite (dev)" : "set") : "DATABASE_URL is not set");
  if (isProd && sqlite) add("Production database engine", "warn", "SQLite in production — switch to PostgreSQL");

  add("Session secret", strongSecret(env.SESSION_SECRET) ? "pass" : "fail",
    strongSecret(env.SESSION_SECRET) ? "strong" : "missing, default, or too short (need ≥16 chars)");
  add("Encryption key", strongSecret(env.ENCRYPTION_KEY) ? "pass" : (isProd ? "fail" : "warn"),
    strongSecret(env.ENCRYPTION_KEY) ? "strong" : "set ENCRYPTION_KEY (AES-256-GCM) for production");

  add("AI provider", aiConfigured ? "pass" : (isProd ? "fail" : "warn"),
    aiConfigured ? "configured" : "no key — offline fallback only");

  const googleOk = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  add("Google OAuth (Gmail/Calendar)", googleOk ? "pass" : (isProd ? "fail" : "warn"),
    googleOk ? "client id + secret set" : "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing");

  add("Platform admin email", env.PLATFORM_ADMIN_EMAIL ? "pass" : "warn",
    env.PLATFORM_ADMIN_EMAIL ? "set" : "optional (used by npm run admin:create)");

  return checks;
}

export const SYMBOL = { pass: "✓", fail: "✗", warn: "⚠" };
