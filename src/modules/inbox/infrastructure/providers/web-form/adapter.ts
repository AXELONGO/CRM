import { createHmac, timingSafeEqual } from "node:crypto";
import type { ProviderConnection } from "@/modules/inbox/application/ports";
import type { NormalizedInboundEvent } from "@/modules/inbox/domain/canonical";

export type PublicFormSubmission = {
  formKey: string;
  idempotencyKey: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
  consent: boolean;
  website?: string;
  submittedAt: number;
};
export function validateFormSubmission(
  input: PublicFormSubmission,
  signingKey: string,
  now = Date.now(),
) {
  if (
    !input.formKey ||
    !input.idempotencyKey ||
    !input.name.trim() ||
    input.name.length > 160 ||
    (input.message && input.message.length > 20_000)
  )
    throw new Error("FORM_INVALID");
  if (!input.consent) throw new Error("FORM_CONSENT_REQUIRED");
  if (input.website) throw new Error("FORM_SPAM_REJECTED");
  if (input.submittedAt > now + 60_000 || input.submittedAt < now - 86_400_000)
    throw new Error("FORM_TIMESTAMP_INVALID");
  const expected = createHmac("sha256", signingKey)
    .update(JSON.stringify(input))
    .digest("hex");
  return expected;
}
export function verifyFormSignature(
  body: Buffer,
  signature: string | null,
  signingKey: string,
) {
  const expected = createHmac("sha256", signingKey).update(body).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature ?? "");
  return left.length === right.length && timingSafeEqual(left, right);
}
export class WebFormAdapter {
  readonly channel = "web_form" as const;
  verifyWebhook(rawBody: Buffer, headers: Headers, connection: ProviderConnection) {
    return {
      valid: verifyFormSignature(
        rawBody,
        headers.get("x-form-signature"),
        connection.secrets.signingKey ?? "",
      ),
    };
  }
  normalizeInbound(
    rawBody: Buffer,
    connection: ProviderConnection,
  ): NormalizedInboundEvent[] {
    const submission = JSON.parse(rawBody.toString("utf8")) as PublicFormSubmission;
    return [
      {
        channel: this.channel,
        connectionId: connection.id,
        externalEventId: submission.idempotencyKey,
        conversationId: submission.idempotencyKey,
        participantId:
          submission.email?.toLowerCase() ??
          submission.phone ??
          submission.idempotencyKey,
        participantName: submission.name,
        address: submission.email ?? submission.phone,
        messageId: submission.idempotencyKey,
        kind: "form_submission",
        text: submission.message,
      },
    ];
  }
}
