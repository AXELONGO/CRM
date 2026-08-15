import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { commercialContacts, inboxConnections } from "@/infrastructure/database/schema";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { enqueueOutbound } from "@/modules/inbox/infrastructure/repositories";
const schema = z.object({
  clientIdempotencyId: z.string().min(8).max(120),
  text: z.string().trim().min(1).max(20000),
  kind: z.enum(["text", "image", "audio", "video", "document"]).default("text"),
  membershipId: z.string(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; conversationId: string }> },
) {
  try {
    const { tenantSlug, conversationId } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "inbox.reply",
    );
    const body = schema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, async (tx) => {
      const [conversation] = await tx
        .select({
          connectionId: (await import("@/infrastructure/database/schema"))
            .inboxConversations.connectionId,
          contactId: (await import("@/infrastructure/database/schema"))
            .inboxConversations.contactId,
        })
        .from((await import("@/infrastructure/database/schema")).inboxConversations)
        .where(
          and(
            eq(
              (await import("@/infrastructure/database/schema")).inboxConversations
                .tenantId,
              context.tenant.id,
            ),
            eq(
              (await import("@/infrastructure/database/schema")).inboxConversations.id,
              conversationId,
            ),
          ),
        )
        .limit(1);
      if (!conversation) throw new Error("INBOX_NOT_FOUND");
      if (conversation.contactId) {
        const [contact] = await tx
          .select({ doNotContact: commercialContacts.doNotContact })
          .from(commercialContacts)
          .where(
            and(
              eq(commercialContacts.tenantId, context.tenant.id),
              eq(commercialContacts.id, conversation.contactId),
            ),
          )
          .limit(1);
        if (contact?.doNotContact) throw new Error("INBOX_DO_NOT_CONTACT");
      }
      const [connection] = await tx
        .select({
          channel: inboxConnections.channel,
          capabilities: inboxConnections.capabilities,
        })
        .from(inboxConnections)
        .where(
          and(
            eq(inboxConnections.tenantId, context.tenant.id),
            eq(inboxConnections.id, conversation.connectionId),
          ),
        )
        .limit(1);
      if (!connection || !(connection.capabilities as Record<string, boolean>).sendText)
        throw new Error("INBOX_CHANNEL_READ_ONLY");
      return enqueueOutbound(tx, {
        tenantId: context.tenant.id,
        connectionId: conversation.connectionId,
        conversationId,
        senderMembershipId: body.membershipId,
        actorUserId: context.membership.userId,
        request: {
          connectionId: conversation.connectionId,
          conversationId,
          clientIdempotencyId: body.clientIdempotencyId,
          kind: body.kind,
          text: body.text,
        },
      });
    });
    return NextResponse.json({ message: result }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo encolar la respuesta." },
      { status: salesAuthorizationError(error) },
    );
  }
}
