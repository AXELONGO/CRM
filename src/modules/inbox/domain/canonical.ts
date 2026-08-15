export const channelTypes = [
  "whatsapp_meta",
  "whatsapp_waha",
  "web_form",
  "email",
  "meta_lead_ads",
  "messenger",
  "instagram",
] as const;
export type ChannelType = (typeof channelTypes)[number];
export type ConnectionId = string;
export type ExternalAccountId = string;
export type ExternalConversationId = string;
export type ExternalParticipantId = string;
export type ExternalMessageId = string;
export type MessageKind =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "contact_card"
  | "form_submission"
  | "unsupported";
export type MessageDirection = "inbound" | "outbound";

export type ChannelCapabilities = {
  receiveText: boolean;
  sendText: boolean;
  receiveAttachments: boolean;
  sendAttachments: boolean;
  deliveryStatuses: boolean;
  readStatuses: boolean;
  contextualReply: boolean;
  responseWindowHours: number | null;
  templatesRequiredOutsideWindow: boolean;
  maxAttachmentBytes: number;
  allowedMimeTypes: string[];
};

export type NormalizedInboundEvent = {
  channel: ChannelType;
  connectionId: ConnectionId;
  externalEventId?: string;
  conversationId: ExternalConversationId;
  participantId: ExternalParticipantId;
  participantName?: string;
  address?: string;
  messageId: ExternalMessageId;
  kind: MessageKind;
  text?: string;
  providerTimestamp?: Date;
  replyToMessageId?: string;
  status?: "sent" | "delivered" | "read" | "failed";
  media?: { url: string; mimeType?: string; fileName?: string; sizeBytes?: number };
};

export type OutboundMessageRequest = {
  connectionId: ConnectionId;
  conversationId: ExternalConversationId;
  clientIdempotencyId: string;
  kind: Extract<MessageKind, "text" | "image" | "audio" | "video" | "document">;
  text?: string;
  media?: { storageKey: string; mimeType: string; fileName: string };
};
export type DeliveryStatusEvent = {
  connectionId: ConnectionId;
  messageId: ExternalMessageId;
  externalEventId: string;
  status: "sent" | "delivered" | "read" | "failed";
  providerTimestamp?: Date;
  errorCode?: string;
};

export const capabilities: Record<ChannelType, ChannelCapabilities> = {
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
  whatsapp_waha: {
    receiveText: true,
    sendText: true,
    receiveAttachments: true,
    sendAttachments: true,
    deliveryStatuses: true,
    readStatuses: false,
    contextualReply: true,
    responseWindowHours: null,
    templatesRequiredOutsideWindow: false,
    maxAttachmentBytes: 25_000_000,
    allowedMimeTypes: ["image/*", "audio/*", "video/*", "application/pdf"],
  },
  web_form: {
    receiveText: true,
    sendText: false,
    receiveAttachments: false,
    sendAttachments: false,
    deliveryStatuses: false,
    readStatuses: false,
    contextualReply: false,
    responseWindowHours: null,
    templatesRequiredOutsideWindow: false,
    maxAttachmentBytes: 0,
    allowedMimeTypes: [],
  },
  email: {
    receiveText: true,
    sendText: true,
    receiveAttachments: true,
    sendAttachments: true,
    deliveryStatuses: false,
    readStatuses: false,
    contextualReply: true,
    responseWindowHours: null,
    templatesRequiredOutsideWindow: false,
    maxAttachmentBytes: 25_000_000,
    allowedMimeTypes: ["image/*", "application/pdf", "text/plain"],
  },
  meta_lead_ads: {
    receiveText: true,
    sendText: false,
    receiveAttachments: false,
    sendAttachments: false,
    deliveryStatuses: false,
    readStatuses: false,
    contextualReply: false,
    responseWindowHours: null,
    templatesRequiredOutsideWindow: false,
    maxAttachmentBytes: 0,
    allowedMimeTypes: [],
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
    allowedMimeTypes: ["image/*", "video/*", "application/pdf"],
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
