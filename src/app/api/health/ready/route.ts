import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { getEnvironment } from "@/infrastructure/config/env";

export async function GET() {
  try {
    getEnvironment();
    await getDatabase().execute(sql`select 1`);
    return NextResponse.json(
      { status: "ready" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "not_ready", reason: "dependency_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
