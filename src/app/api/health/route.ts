import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public health endpoint. Reports service status without leaking internals.
export async function GET() {
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  const healthy = database;
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks: { database } },
    { status: healthy ? 200 : 503 }
  );
}
