import { NextResponse } from "next/server";

// Liveness: is the process up and serving? No dependencies checked.
// Use this for load-balancer "is it alive" probes.
export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
