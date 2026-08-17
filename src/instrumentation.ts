// Next.js instrumentation hook — runs once when the server process starts.
// Logs a clean, secret-free status summary so operators can see at a glance
// what is configured. Never prints any secret values.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { config, configStatus } = await import("@/lib/config");

  const label = (s: "ok" | "missing" | "n/a") =>
    s === "ok" ? "READY" : s === "missing" ? "MISSING" : "n/a";

  const rows = configStatus();
  const lines = [
    "",
    "  ┌───────────────────────────────────────",
    `  │  DONE — ${config.isProd ? "Production" : "Development"}`,
    "  ├───────────────────────────────────────",
    `  │  Web            READY`,
    ...rows.map((r) => `  │  ${r.label.padEnd(28, " ")} ${label(r.state)}`),
    "  └───────────────────────────────────────",
    config.isProd ? "  Run `npm run production:check` to validate before serving traffic." : "",
    "",
  ];
  console.log(lines.filter(Boolean).join("\n"));
}
