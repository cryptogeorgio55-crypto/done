// DONE — production configuration validator.
// Usage: npm run production:check
// Exits non-zero if any critical check fails. Never prints secret values.
import { loadEnv, buildChecks, SYMBOL } from "./_env.mjs";

loadEnv();
const checks = buildChecks();

console.log("\n  DONE — Production Check\n");
for (const c of checks) {
  const pad = c.label.padEnd(34, " ");
  console.log(`  ${SYMBOL[c.status]} ${pad} ${c.detail}`);
}

const failed = checks.filter((c) => c.status === "fail");
const warned = checks.filter((c) => c.status === "warn");

console.log("");
if (failed.length) {
  console.log(`  ✗ PRODUCTION CONFIGURATION FAILED — ${failed.length} critical issue(s).`);
  console.log(`    Fix: ${failed.map((f) => f.label).join(", ")}`);
  if (warned.length) console.log(`  ⚠ ${warned.length} warning(s): ${warned.map((w) => w.label).join(", ")}`);
  console.log("");
  process.exit(1);
}
console.log(`  ✓ PRODUCTION CONFIGURATION PASSED${warned.length ? ` (${warned.length} warning(s))` : ""}.`);
if (warned.length) console.log(`    Review: ${warned.map((w) => w.label).join(", ")}`);
console.log("");
process.exit(0);
