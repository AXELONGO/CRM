import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ChannelCapabilities,
  ChannelType,
  DeliveryStatusEvent,
  NormalizedInboundEvent,
} from "@/modules/inbox/domain/canonical";
import type {
  OutboundChannelAdapter,
  ProviderConnection,
} from "@/modules/inbox/application/ports";

const metaCapabilities: Record<
  Extract<ChannelType, "whatsapp_meta" | "messenger" | "instagram">,
  ChannelCapabilities
> = {
  whatsapp_meta: {
    receiveText: true,
    sendText: true,
    receiveAttachments: true,
    sendAttachments: true,
    deliveryStatuses: true,
    readStatuses: true,
    contextualReply: true,
    responseWindowHours: 24,
    templatesRequiredOutsideWindow: true,
    maxAttachmentBytes: 25_000_000,
    allowedMimeTypes: ["image/*", "audio/*", "video/*", "application/pdf"],
  },
  messenger: {
    receiveText: true,
    sendText: true,
    receiveAttachments: true,
    sendAttachments: true,
    deliveryStatuses: true,
    readStatuses: false,
    contextualReply: true,
    responseWindowHours: 24,
    templatesRequiredOutsideWindow: false,
    maxAttachmentBytes: 25_000_000,
    allowedMimeTypes: ["image/*", "video/*"],
  },
  instagram: {
    receiveText: true,
    sendText: true,
    receiveAttachments: true,
    sendAttachments: true,
    deliveryStatuses: false,
    readStatuses: false,
    contextualReply: true,
    responseWindowHours: 24,
    templatesRequiredOutsideWindow: false,
    maxAttachmentBytes: 25_000_000,
    allowedMimeTypes: ["image/*", "video/*"],
  },
};

export function verifyMetaSignature(
  rawBody: Buffer,
  header: string | null,
  appSecret: string,
) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = header.slice(7);
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseMetaEvents(
  rawBody: Buffer,
  connection: ProviderConnection,
  channel: ChannelType,
): NormalizedInboundEvent[] {
  const payload = JSON.parse(rawBody.toString("utf8")) as {
    entry?: Array<{
      id?: string;
      changes?: Array<{
        value?: {
          messages?: Array<Record<string, unknown>>;
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        };
      }>;
      messaging?: Array<Record<string, unknown>>;
    }>;
  };
  const events: NormalizedInboundEvent[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const message of value?.messages ?? []) {
        const id = typeof message.id === "string" ? message.id : null;
        const from = typeof message.from === "string" ? message.from : null;
        if (!id || !from) continue;
        const contact = value?.contacts?.[0];
        const type = typeof message.type === "string" ? message.type : "unsupported";
        const detail =
          typeof message[type] === "object" && message[type]
            ? (message[type] as { id?: string; mime_type?: string; filename?: string })
            : undefined;
        events.push({
          channel,
          connectionId: connection.id,
          externalEventId: id,
          conversationId: from,
          participantId: from,
          participantName: contact?.profile?.name,
          address: from,
          messageId: id,
          kind:
            type === "text"
              ? "text"
              : ["image", "audio", "video", "document"].includes(type)
                ? (type as NormalizedInboundEvent["kind"])
                : "unsupported",
          text:
            typeof message.text === "object" && message.text
              ? String((message.text as { body?: unknown }).body ?? "")
              : undefined,
          providerTimestamp:
            typeof message.timestamp === "string"
              ? new Date(Number(message.timestamp) * 1000)
              : undefined,
          media: detail?.id
            ? { url: detail.id, mimeType: detail.mime_type, fileName: detail.filename }
            : undefined,
        });
      }
    }
    for (const message of entry.messaging ?? []) {
      const messageData =
        typeof message.message === "object" && message.message
          ? (message.message as { mid?: string; text?: string; is_echo?: boolean })
          : undefined;
      const sender =
        typeof message.sender === "object" && message.sender
          ? (message.sender as { id?: string }).id
          : undefined;
      if (!messageData?.mid || !sender || messageData.is_echo) continue;
      events.push({
        channel,
        connectionId: connection.id,
        externalEventId: messageData.mid,
        conversationId: entry.id ?? sender,
        participantId: sender,
        messageId: messageData.mid,
        kind: messageData.text ? "text" : "unsupported",
        text: messageData.text,
        providerTimestamp:
          typeof message.timestamp === "number"
            ? new Date(message.timestamp)
            : undefined,
      });
    }
  }
  return events;
}

export function parseMetaStatuses(
  rawBody: Buffer,
  connectionId: string,
  _channel: ChannelType,
): DeliveryStatusEvent[] {
  const payload = JSON.parse(rawBody.toString("utf8")) as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id: string;
            status: string;
            timestamp?: string;
            errors?: Array<{ code?: string }>;
          }>;
        };
      }>;
    }>;
  };
  return (payload.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) =>
      (change.value?.statuses ?? []).map((status) => ({
        connectionId,
        messageId: status.id,
        externalEventId: `${status.id}:${status.status}:${status.timestamp ?? ""}`,
        status:
          status.status === "read" ||
          status.status === "delivered" ||
          status.status === "sent"
            ? status.status
            : "failed",
        providerTimestamp: status.timestamp
          ? new Date(Number(status.timestamp) * 1000)
          : undefined,
        errorCode: status.errors?.[0]?.code,
      })),
    ),
  );
}

export class MetaAdapter implements OutboundChannelAdapter {
  constructor(
    public readonly channel: Extract<
      ChannelType,
      "whatsapp_meta" | "messenger" | "instagram"
    >,
  ) {}
  async verifyWebhook(
    rawBody: Buffer,
    headers: Headers,
    connection: ProviderConnection,
  ) {
    return {
      valid: verifyMetaSignature(
        rawBody,
        headers.get("x-hub-signature-256"),
        connection.secrets.appSecret ?? "",
      ),
    };
  }
  normalizeInbound(rawBody: Buffer, connection: ProviderConnection) {
    return parseMetaEvents(rawBody, connection, this.channel);
  }
  capabilities() {
    return metaCapabilities[this.channel];
  }
  async send(request: { text?: string }, connection: ProviderConnection) {
    if (!request.text) throw new Error("OUTBOUND_TEXT_REQUIRED");
    if (
      !connection.externalIdentifiers.phoneNumberId &&
      this.channel === "whatsapp_meta"
    )
      throw new Error("META_PHONE_NUMBER_REQUIRED");
    return { externalMessageId: `simulated:${crypto.randomUUID()}` };
  }
}
