// Developer setup automation. Non-destructive: it will not overwrite an
// existing .env or drop data. Run: npm run setup
import { existsSync, copyFileSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

console.log("DONE — development setup\n");

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`Node 20+ required. You have ${process.versions.node}.`);
  process.exit(1);
}

// 1. Ensure .env exists with a real session secret.
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  const secret = randomBytes(48).toString("hex");
  const env = readFileSync(".env", "utf8").replace(
    /SESSION_SECRET=".*"/,
    `SESSION_SECRET="${secret}"`
  );
  writeFileSync(".env", env);
  console.log("✓ Created .env from .env.example with a generated SESSION_SECRET.");
} else {
  console.log("✓ .env already exists — leaving it untouched.");
}

// 2. Prisma client + schema + seed.
run("npx prisma generate");
run("npx prisma db push");
run("npx tsx prisma/seed.ts");

console.log("\n✓ Setup complete. Start the app with:  npm run dev");
