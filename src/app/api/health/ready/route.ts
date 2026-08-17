import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Readiness: can we serve real traffic? Checks the database connection.
// Use this to gate traffic during deploys/migrations.
export async function GET() {
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  return NextResponse.json(
    { status: database ? "ready" : "not_ready", checks: { database } },
    { status: database ? 200 : 503 }
  );
}
