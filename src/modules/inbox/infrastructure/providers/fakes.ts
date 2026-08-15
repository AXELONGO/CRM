import type {
  InboundChannelAdapter,
  OutboundChannelAdapter,
  ProviderConnection,
} from "@/modules/inbox/application/ports";
import type {
  ChannelType,
  NormalizedInboundEvent,
} from "@/modules/inbox/domain/canonical";

export class FixtureAdapter implements OutboundChannelAdapter {
  constructor(
    public readonly channel: ChannelType,
    private readonly fixtureEvents: NormalizedInboundEvent[] = [],
  ) {}
  async verifyWebhook() {
    return { valid: true };
  }
  normalizeInbound(_body: Buffer, connection: ProviderConnection) {
    return this.fixtureEvents.map((event) => ({
      ...event,
      connectionId: connection.id,
      channel: this.channel,
    }));
  }
  capabilities() {
    return {
      receiveText: true,
      sendText: true,
      receiveAttachments: false,
      sendAttachments: false,
      deliveryStatuses: true,
      readStatuses: false,
      contextualReply: true,
      responseWindowHours: null,
      templatesRequiredOutsideWindow: false,
      maxAttachmentBytes: 0,
      allowedMimeTypes: [],
    };
  }
  async send() {
    return { externalMessageId: `fake:${crypto.randomUUID()}` };
  }
}
