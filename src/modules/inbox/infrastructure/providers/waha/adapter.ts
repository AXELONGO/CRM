import type { ChannelType } from "@/modules/inbox/domain/canonical";
import type {
  OutboundChannelAdapter,
  ProviderConnection,
} from "@/modules/inbox/application/ports";
import { parseWahaEvents } from "./parser";
import { verifyWahaHmac } from "@/modules/integrations/domain/waha";

export class WahaAdapter implements OutboundChannelAdapter {
  readonly channel: Extract<ChannelType, "whatsapp_waha"> = "whatsapp_waha";
  async verifyWebhook(
    rawBody: Buffer,
    headers: Headers,
    connection: ProviderConnection,
  ) {
    return {
      valid: verifyWahaHmac(rawBody, headers, connection.secrets.hmacKey ?? ""),
    };
  }
  normalizeInbound(rawBody: Buffer, connection: ProviderConnection) {
    return parseWahaEvents(rawBody, connection.id);
  }
  capabilities() {
    return {
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
    };
  }
  async send(request: { text?: string }, connection: ProviderConnection) {
    if (!request.text) throw new Error("OUTBOUND_TEXT_REQUIRED");
    if (!connection.externalIdentifiers.sessionName)
      throw new Error("WAHA_SESSION_REQUIRED");
    if (process.env.WAHA_LIVE_ENABLED === "true")
      throw new Error("WAHA_LIVE_DISABLED_IN_THIS_BUILD");
    return { externalMessageId: `fake-waha:${crypto.randomUUID()}` };
  }
}
