import { and, asc, desc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  addContactMethod,
  createContact,
  findContactDuplicates,
} from "@/modules/commercial-directory/infrastructure/repositories";
import {
  normalizeEmail,
  normalizePhone,
} from "@/modules/commercial-directory/domain/normalization";
import {
  commercialContacts,
  inboxConnections,
  inboxConversations,
  inboxMessages,
  integrationJobs,
  channelIdentities,
  conversationAssignments,
  conversationInternalNotes,
  conversationReads,
  messageStatusEvents,
} from "@/infrastructure/database/schema";
import {
  tenantMembershipRoles,
  tenantMemberships,
} from "@/infrastructure/database/schema";
import type {
  DeliveryStatusEvent,
  NormalizedInboundEvent,
  OutboundMessageRequest,
} from "../domain/canonical";

type Tx = TenantTransaction;

function safeText(value: string | undefined, max = 20_000) {
  return value?.trim().slice(0, max) || null;
}
async function resolveIdentity(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    connectionId: string;
    event: NormalizedInboundEvent;
  },
) {
  const existing = await tx
    .select()
    .from(channelIdentities)
    .where(
      and(
        eq(channelIdentities.tenantId, input.tenantId),
        eq(channelIdentities.connectionId, input.connectionId),
        eq(channelIdentities.externalParticipantId, input.event.participantId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const method = input.event.address?.includes("@")
    ? { type: "email" as const, value: normalizeEmail(input.event.address) }
    : input.event.address
      ? {
          type:
            input.event.channel === "whatsapp_meta" ||
            input.event.channel === "whatsapp_waha"
              ? ("whatsapp" as const)
              : ("phone" as const),
          value: normalizePhone(
            input.event.address,
            input.event.address.startsWith("+") ? undefined : "+52",
          ),
        }
      : null;
  const connection = await tx
    .select({ createdByUserId: inboxConnections.createdByUserId })
    .from(inboxConnections)
    .where(
      and(
        eq(inboxConnections.tenantId, input.tenantId),
        eq(inboxConnections.id, input.connectionId),
      ),
    )
    .limit(1);
  if (!connection[0]) throw new Error("INBOX_CONNECTION_NOT_FOUND");
  const duplicates = input.event.participantName
    ? await findContactDuplicates(tx, {
        tenantId: input.tenantId,
        displayName: input.event.participantName,
        methods: method ? [method] : [],
      })
    : [];
  let contactId: string | null = duplicates.length === 1 ? duplicates[0].id : null;
  let status: "unresolved" | "linked" | "ambiguous" =
    duplicates.length > 1 ? "ambiguous" : "unresolved";
  if (!duplicates.length && input.event.participantName) {
    const contact = await createContact(tx, {
      tenantId: input.tenantId,
      actorUserId: connection[0].createdByUserId,
      displayName: input.event.participantName,
    });
    contactId = contact.id;
    status = "linked";
    if (method)
      await addContactMethod(tx, {
        tenantId: input.tenantId,
        contactId: contact.id,
        actorUserId: connection[0].createdByUserId,
        type: method.type,
        label: "other",
        value: method.value,
        isPrimary: true,
      });
  }
  const [identity] = await tx
    .insert(channelIdentities)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      externalParticipantId: input.event.participantId,
      channel: input.event.channel,
      contactId,
      externalDisplayName: safeText(input.event.participantName, 160),
      normalizedAddress: method?.value ?? null,
      status,
    })
    .returning();
  return identity;
}

export async function ingestNormalizedEvent(
  tx: Tx,
  tenantId: string,
  event: NormalizedInboundEvent,
) {
  if (event.status)
    return applyDeliveryStatus(tx, {
      tenantId,
      connectionId: event.connectionId,
      messageId: event.messageId,
      externalEventId: event.externalEventId ?? `${event.messageId}:${event.status}`,
      status: event.status,
      providerTimestamp: event.providerTimestamp,
    });
  const [existingMessage] = await tx
    .select()
    .from(inboxMessages)
    .where(
      and(
        eq(inboxMessages.connectionId, event.connectionId),
        eq(inboxMessages.externalMessageId, event.messageId),
      ),
    )
    .limit(1);
  if (existingMessage) return existingMessage;
  const identity = await resolveIdentity(tx, {
    tenantId,
    actorUserId: "",
    connectionId: event.connectionId,
    event,
  });
  const [existingConversation] = await tx
    .select()
    .from(inboxConversations)
    .where(
      and(
        eq(inboxConversations.tenantId, tenantId),
        eq(inboxConversations.connectionId, event.connectionId),
        eq(inboxConversations.externalThreadId, event.conversationId),
      ),
    )
    .limit(1);
  const now = new Date();
  let conversation = existingConversation;
  if (!conversation) {
    [conversation] = await tx
      .insert(inboxConversations)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        connectionId: event.connectionId,
        channel: event.channel,
        externalThreadId: event.conversationId,
        identityId: identity.id,
        contactId: identity.contactId,
        status: "open",
        firstMessageAt: event.providerTimestamp ?? now,
        lastMessageAt: event.providerTimestamp ?? now,
        lastInboundAt: event.providerTimestamp ?? now,
        updatedAt: now,
      })
      .returning();
  } else {
    [conversation] = await tx
      .update(inboxConversations)
      .set({
        identityId: identity.id,
        contactId: identity.contactId,
        lastMessageAt: event.providerTimestamp ?? now,
        lastInboundAt: event.providerTimestamp ?? now,
        status: conversation.status === "closed" ? "open" : conversation.status,
        version: sql`${inboxConversations.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(inboxConversations.tenantId, tenantId),
          eq(inboxConversations.id, conversation.id),
        ),
      )
      .returning();
  }
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(inboxMessages)
    .where(
      and(
        eq(inboxMessages.tenantId, tenantId),
        eq(inboxMessages.conversationId, conversation.id),
      ),
    );
  const [message] = await tx
    .insert(inboxMessages)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      conversationId: conversation.id,
      connectionId: event.connectionId,
      direction: "inbound",
      kind: event.kind,
      externalMessageId: event.messageId,
      senderIdentityId: identity.id,
      bodyText: safeText(event.text),
      status: "received",
      replyToMessageId: event.replyToMessageId ?? null,
      providerTimestamp: event.providerTimestamp ?? null,
      serverSequence: Number(count) + 1,
    })
    .returning();
  return message;
}

export async function applyDeliveryStatus(
  tx: Tx,
  event: DeliveryStatusEvent & { tenantId: string },
) {
  const [message] = await tx
    .select()
    .from(inboxMessages)
    .where(
      and(
        eq(inboxMessages.tenantId, event.tenantId),
        eq(inboxMessages.connectionId, event.connectionId),
        eq(inboxMessages.externalMessageId, event.messageId),
      ),
    )
    .limit(1);
  if (!message) return null;
  await tx
    .insert(messageStatusEvents)
    .values({
      id: crypto.randomUUID(),
      tenantId: event.tenantId,
      messageId: message.id,
      externalEventId: event.externalEventId,
      status: event.status,
      providerTimestamp: event.providerTimestamp ?? null,
    })
    .onConflictDoNothing();
  const [updated] = await tx
    .update(inboxMessages)
    .set({
      status: event.status,
      errorCode: event.errorCode ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(inboxMessages.tenantId, event.tenantId), eq(inboxMessages.id, message.id)),
    )
    .returning();
  return updated;
}

export async function listConversations(
  tx: Tx,
  input: {
    tenantId: string;
    limit?: number;
    status?: "open" | "pending" | "closed" | "spam";
    channel?: NormalizedInboundEvent["channel"];
  },
) {
  return tx
    .select()
    .from(inboxConversations)
    .where(
      and(
        eq(inboxConversations.tenantId, input.tenantId),
        input.status ? eq(inboxConversations.status, input.status) : undefined,
        input.channel ? eq(inboxConversations.channel, input.channel) : undefined,
      ),
    )
    .orderBy(desc(inboxConversations.updatedAt), desc(inboxConversations.id))
    .limit(Math.min(input.limit ?? 50, 100));
}
export async function getConversation(
  tx: Tx,
  tenantId: string,
  conversationId: string,
) {
  const [conversation] = await tx
    .select()
    .from(inboxConversations)
    .where(
      and(
        eq(inboxConversations.tenantId, tenantId),
        eq(inboxConversations.id, conversationId),
      ),
    )
    .limit(1);
  if (!conversation) throw new Error("INBOX_NOT_FOUND");
  const messages = await tx
    .select()
    .from(inboxMessages)
    .where(
      and(
        eq(inboxMessages.tenantId, tenantId),
        eq(inboxMessages.conversationId, conversationId),
      ),
    )
    .orderBy(asc(inboxMessages.serverSequence))
    .limit(200);
  const notes = await tx
    .select()
    .from(conversationInternalNotes)
    .where(
      and(
        eq(conversationInternalNotes.tenantId, tenantId),
        eq(conversationInternalNotes.conversationId, conversationId),
      ),
    )
    .orderBy(desc(conversationInternalNotes.createdAt))
    .limit(100);
  return { conversation, messages, notes };
}
export async function assignConversation(
  tx: Tx,
  input: {
    tenantId: string;
    conversationId: string;
    actorUserId: string;
    membershipId: string | null;
    reason?: string | null;
  },
) {
  const [conversation] = await tx
    .select()
    .from(inboxConversations)
    .where(
      and(
        eq(inboxConversations.tenantId, input.tenantId),
        eq(inboxConversations.id, input.conversationId),
      ),
    )
    .limit(1);
  if (!conversation) throw new Error("INBOX_NOT_FOUND");
  const [updated] = await tx
    .update(inboxConversations)
    .set({
      assignedMembershipId: input.membershipId,
      version: sql`${inboxConversations.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inboxConversations.tenantId, input.tenantId),
        eq(inboxConversations.id, input.conversationId),
        eq(inboxConversations.version, conversation.version),
      ),
    )
    .returning();
  if (!updated) throw new Error("INBOX_CONFLICT");
  await tx.insert(conversationAssignments).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    previousMembershipId: conversation.assignedMembershipId,
    newMembershipId: input.membershipId,
    actorUserId: input.actorUserId,
    reason: safeText(input.reason ?? undefined, 500),
  });
  return updated;
}
export async function updateConversationStatus(
  tx: Tx,
  input: {
    tenantId: string;
    conversationId: string;
    status: "open" | "pending" | "closed" | "spam";
  },
) {
  const [updated] = await tx
    .update(inboxConversations)
    .set({
      status: input.status,
      updatedAt: new Date(),
      version: sql`${inboxConversations.version} + 1`,
    })
    .where(
      and(
        eq(inboxConversations.tenantId, input.tenantId),
        eq(inboxConversations.id, input.conversationId),
      ),
    )
    .returning();
  if (!updated) throw new Error("INBOX_NOT_FOUND");
  return updated;
}
export async function addInternalNote(
  tx: Tx,
  input: {
    tenantId: string;
    conversationId: string;
    authorUserId: string;
    bodyText: string;
  },
) {
  const [conversation] = await tx
    .select({ id: inboxConversations.id })
    .from(inboxConversations)
    .where(
      and(
        eq(inboxConversations.tenantId, input.tenantId),
        eq(inboxConversations.id, input.conversationId),
      ),
    )
    .limit(1);
  if (!conversation) throw new Error("INBOX_NOT_FOUND");
  const [note] = await tx
    .insert(conversationInternalNotes)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      authorUserId: input.authorUserId,
      bodyText: input.bodyText.trim(),
    })
    .returning();
  return note;
}
export async function enqueueOutbound(
  tx: Tx,
  input: {
    tenantId: string;
    connectionId: string;
    conversationId: string;
    senderMembershipId: string;
    actorUserId: string;
    request: OutboundMessageRequest;
  },
) {
  const membershipRows = await tx
    .select({ status: tenantMemberships.status, role: tenantMembershipRoles.role })
    .from(tenantMemberships)
    .innerJoin(
      tenantMembershipRoles,
      eq(tenantMembershipRoles.membershipId, tenantMemberships.id),
    )
    .where(
      and(
        eq(tenantMemberships.tenantId, input.tenantId),
        eq(tenantMemberships.id, input.senderMembershipId),
      ),
    );
  if (
    !membershipRows.length ||
    membershipRows[0].status !== "active" ||
    !membershipRows.some(({ role }) => role === "sales" || role === "tenant_admin")
  ) {
    throw new Error("INBOX_SENDER_INVALID");
  }
  const [conversation] = await tx
    .select()
    .from(inboxConversations)
    .where(
      and(
        eq(inboxConversations.tenantId, input.tenantId),
        eq(inboxConversations.id, input.conversationId),
        eq(inboxConversations.connectionId, input.connectionId),
      ),
    )
    .limit(1);
  if (!conversation) throw new Error("INBOX_NOT_FOUND");
  const [{ nextSequence }] = await tx
    .select({
      nextSequence: sql<number>`coalesce(max(${inboxMessages.serverSequence}), 0) + 1`,
    })
    .from(inboxMessages)
    .where(
      and(
        eq(inboxMessages.tenantId, input.tenantId),
        eq(inboxMessages.conversationId, input.conversationId),
      ),
    );
  const [message] = await tx
    .insert(inboxMessages)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      connectionId: input.connectionId,
      direction: "outbound",
      kind: input.request.kind,
      clientIdempotencyId: input.request.clientIdempotencyId,
      senderMembershipId: input.senderMembershipId,
      bodyText: safeText(input.request.text),
      status: "queued",
      serverSequence: nextSequence,
    })
    .onConflictDoNothing()
    .returning();
  if (!message)
    return tx
      .select()
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.tenantId, input.tenantId),
          eq(inboxMessages.clientIdempotencyId, input.request.clientIdempotencyId),
        ),
      )
      .limit(1)
      .then(([row]) => row);
  await tx.insert(integrationJobs).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    connectionId: input.connectionId,
    messageId: message.id,
    type: "send_message",
    idempotencyKey: `send:${input.tenantId}:${message.id}`,
    priority: 10,
  });
  return message;
}
