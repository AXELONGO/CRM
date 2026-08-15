import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getEnvironment } from "@/infrastructure/config/env";
import { getIngressDatabase } from "@/infrastructure/database/client";
import {
  integrationProviderEvents,
  integrationJobs,
  wahaSessionBindings,
} from "@/infrastructure/database/schema";
import {
  fakeWahaWebhookSecret,
  verifyWahaHmac,
  verifyWahaTimestamp,
} from "@/modules/integrations/domain/waha";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicConnectionKey: string }> },
) {
  try {
    const { publicConnectionKey } = await params;
    const raw = Buffer.from(await request.arrayBuffer());
    if (raw.length > getEnvironment().WEBHOOK_MAX_BODY_BYTES)
      return NextResponse.json({ error: "Webhook rechazado." }, { status: 413 });
    const db = getIngressDatabase();
    const hash = createHash("sha256").update(publicConnectionKey).digest("hex");
    const [binding] = await db
      .select()
      .from(wahaSessionBindings)
      .where(eq(wahaSessionBindings.publicConnectionKeyHash, hash))
      .limit(1);
    const secret = fakeWahaWebhookSecret(publicConnectionKey);
    if (
      !binding ||
      !verifyWahaHmac(raw, request.headers, secret) ||
      !verifyWahaTimestamp(
        request.headers,
        Date.now(),
        getEnvironment().WAHA_WEBHOOK_TOLERANCE_SECONDS,
      )
    )
      return NextResponse.json({ error: "Webhook rechazado." }, { status: 401 });
    const payload = JSON.parse(raw.toString("utf8")) as {
      id?: string;
      event?: string;
      session?: string;
    };
    if (!payload.id || payload.session !== binding.sessionName)
      return NextResponse.json({ error: "Webhook rechazado." }, { status: 400 });
    const providerEventId = payload.id;
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${binding.tenantId}, true)`,
      );
      const [event] = await tx
        .insert(integrationProviderEvents)
        .values({
          id: crypto.randomUUID(),
          tenantId: binding.tenantId,
          connectionId: binding.connectionId,
          dedupKey: providerEventId,
          eventType: payload.event ?? "unknown",
          bodyHash: createHash("sha256").update(raw).digest("hex"),
        })
        .onConflictDoNothing()
        .returning();
      if (event)
        await tx
          .insert(integrationJobs)
          .values({
            id: crypto.randomUUID(),
            tenantId: binding.tenantId,
            connectionId: binding.connectionId,
            type: "process_waha_provider_event",
            idempotencyKey: `waha-event:${binding.connectionId}:${providerEventId}`,
          })
          .onConflictDoNothing();
    });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook rechazado." }, { status: 400 });
  }
}
