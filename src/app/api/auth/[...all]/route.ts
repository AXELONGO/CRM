import { toNextJsHandler } from "better-auth/next-js";
import { assertAuthRuntimeConfig, auth } from "@/infrastructure/auth/auth";

const handler = toNextJsHandler(auth);

export const runtime = "nodejs";

export async function GET(request: Request) {
  assertAuthRuntimeConfig();
  return handler.GET(request);
}

export async function POST(request: Request) {
  assertAuthRuntimeConfig();
  return handler.POST(request);
}
