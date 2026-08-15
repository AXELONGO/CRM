import type { NormalizedInboundEvent } from "@/modules/inbox/domain/canonical";
import { classifyWahaChatId } from "@/modules/integrations/domain/waha";

type WahaPayload = {
  id?: string;
  event?: string;
  session?: string;
  timestamp?: number;
  payload?: {
    id?: string;
    from?: string;
    to?: string;
    fromMe?: boolean;
    body?: string;
    text?: { body?: string };
    _data?: { notifyName?: string };
  };
};

export function parseWahaEvents(
  rawBody: Buffer,
  connectionId: string,
): NormalizedInboundEvent[] {
  let input: WahaPayload;
  try {
    input = JSON.parse(rawBody.toString("utf8")) as WahaPayload;
  } catch {
    return [];
  }
  if (input.event !== "message" || !input.payload?.id || !input.payload.from) return [];
  const participantId = input.payload.from;
  if (classifyWahaChatId(participantId) !== "direct") return [];
  const text = input.payload.body ?? input.payload.text?.body;
  return [
    {
      channel: "whatsapp_waha",
      connectionId,
      externalEventId: input.id,
      conversationId: participantId,
      participantId,
      participantName: input.payload._data?.notifyName,
      messageId: input.payload.id,
      kind: text ? "text" : "unsupported",
      text,
      providerTimestamp: input.timestamp ? new Date(input.timestamp * 1000) : undefined,
    },
  ];
}
