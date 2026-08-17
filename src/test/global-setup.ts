import { execSync } from "child_process";
import { resolve } from "path";
import { existsSync, rmSync } from "fs";

// Create a fresh isolated SQLite database for the whole test run by pushing the
// Prisma schema into prisma/test.db. Runs once before any test.
export default function setup() {
  const testDbPath = resolve(process.cwd(), "prisma/test.db");
  const url = `file:${testDbPath}`;
  for (const f of [testDbPath, `${testDbPath}-journal`]) {
    if (existsSync(f)) rmSync(f);
  }
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
}
