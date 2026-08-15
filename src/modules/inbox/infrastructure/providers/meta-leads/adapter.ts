import type { ProviderConnection } from "@/modules/inbox/application/ports";
import type { NormalizedInboundEvent } from "@/modules/inbox/domain/canonical";
import { verifyMetaSignature } from "../meta/shared";

export class MetaLeadAdsAdapter {
  readonly channel = "meta_lead_ads" as const;
  verifyWebhook(rawBody: Buffer, headers: Headers, connection: ProviderConnection) {
    return {
      valid: verifyMetaSignature(
        rawBody,
        headers.get("x-hub-signature-256"),
        connection.secrets.appSecret ?? "",
      ),
    };
  }
  normalizeInbound(
    rawBody: Buffer,
    connection: ProviderConnection,
  ): NormalizedInboundEvent[] {
    const payload = JSON.parse(rawBody.toString("utf8")) as {
      entry?: Array<{
        changes?: Array<{
          value?: { leadgen_id?: string; form_id?: string; page_id?: string };
        }>;
      }>;
    };
    return (payload.entry ?? []).flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) => {
        const value = change.value;
        if (!value?.leadgen_id) return [];
        return [
          {
            channel: this.channel,
            connectionId: connection.id,
            externalEventId: value.leadgen_id,
            conversationId: value.leadgen_id,
            participantId: value.leadgen_id,
            messageId: value.leadgen_id,
            kind: "form_submission",
            text: "Nuevo prospecto de Meta Lead Ads",
          },
        ];
      }),
    );
  }
}
