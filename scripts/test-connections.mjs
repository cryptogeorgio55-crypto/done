// DONE — safe external connectivity test.
// Usage: npm run production:test-connections
// Performs only READ-ONLY, non-charging checks. Never sends customer email or
// performs destructive actions.
import { loadEnv } from "./_env.mjs";
import { PrismaClient } from "@prisma/client";

loadEnv();
const results = [];
const rec = (label, ok, detail) => results.push({ label, ok, detail });

// --- Database -------------------------------------------------------------
{
  const db = new PrismaClient();
  try {
    await db.$queryRaw`SELECT 1`;
    rec("Database", true, "connected");
  } catch (e) {
    rec("Database", false, e.message.split("\n")[0]);
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

// --- Anthropic (read-only /models) ---------------------------------------
if (process.env.ANTHROPIC_API_KEY) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    });
    rec("Anthropic AI", res.ok, res.ok ? "authenticated" : `HTTP ${res.status}`);
  } catch (e) {
    rec("Anthropic AI", false, e.message);
  }
} else {
  rec("Anthropic AI", null, "no key (skipped)");
}

// --- OpenAI (read-only /models) ------------------------------------------
if (process.env.OPENAI_API_KEY) {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    rec("OpenAI", res.ok, res.ok ? "authenticated" : `HTTP ${res.status}`);
  } catch (e) {
    rec("OpenAI", false, e.message);
  }
} else if (!process.env.ANTHROPIC_API_KEY) {
  rec("OpenAI", null, "no key (skipped)");
}

// --- Google OAuth config (cannot fully test before user consent) ----------
{
  const ok = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  rec("Google OAuth config", ok || null, ok ? "credentials present (per-user consent tested at connect time)" : "not configured (skipped)");
}

// --- Report ---------------------------------------------------------------
console.log("\n  DONE — Connection Test\n");
for (const r of results) {
  const sym = r.ok === true ? "✓" : r.ok === false ? "✗" : "–";
  console.log(`  ${sym} ${r.label.padEnd(22, " ")} ${r.detail}`);
}
console.log("");

const hardFail = results.some((r) => r.ok === false);
process.exit(hardFail ? 1 : 0);
