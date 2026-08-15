import type {
  ChannelCapabilities,
  ChannelType,
  DeliveryStatusEvent,
  NormalizedInboundEvent,
  OutboundMessageRequest,
} from "../domain/canonical";

export type IntegrationSecrets = Record<string, string>;
export type ProviderConnection = {
  id: string;
  channel: ChannelType;
  externalIdentifiers: Record<string, string>;
  providerVersion?: string | null;
  secrets: IntegrationSecrets;
};
export interface InboundChannelAdapter {
  readonly channel: ChannelType;
  verifyWebhook(
    rawBody: Buffer,
    headers: Headers,
    connection: ProviderConnection,
  ): Promise<{ valid: boolean; externalEventId?: string }>;
  normalizeInbound(
    rawBody: Buffer,
    connection: ProviderConnection,
  ): NormalizedInboundEvent[];
  capabilities(connection: ProviderConnection): ChannelCapabilities;
}
export interface OutboundChannelAdapter extends InboundChannelAdapter {
  send(
    request: OutboundMessageRequest,
    connection: ProviderConnection,
  ): Promise<{ externalMessageId: string }>;
}
export interface ObjectStorage {
  put(input: {
    tenantId: string;
    key: string;
    body: AsyncIterable<Uint8Array> | Uint8Array;
    contentType: string;
  }): Promise<{ key: string; sha256: string; sizeBytes: number }>;
  read(input: { tenantId: string; key: string }): Promise<Uint8Array>;
  remove(input: { tenantId: string; key: string }): Promise<void>;
}
