// Runs before each test module is imported. Point Prisma at an isolated test
// database so DB-backed tests never touch the developer's dev.db.
import { resolve } from "path";

process.env.DATABASE_URL = `file:${resolve(process.cwd(), "prisma/test.db")}`;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-only-session-secret-000000000000000000000000000000";
process.env.AI_PROVIDER = "offline"; // deterministic, no network in tests
