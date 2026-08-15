import { NextResponse } from "next/server";

const serviceVersion = process.env.npm_package_version ?? "0.1.0";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "crm",
    version: serviceVersion,
    timestamp: new Date().toISOString(),
  });
}
