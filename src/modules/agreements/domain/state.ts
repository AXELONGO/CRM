import type {
  agreementStatusEnum,
  envelopeStatusEnum,
  recipientStatusEnum,
} from "@/infrastructure/database/schema";

export type AgreementStatus = (typeof agreementStatusEnum.enumValues)[number];
export type EnvelopeStatus = (typeof envelopeStatusEnum.enumValues)[number];
export type RecipientStatus = (typeof recipientStatusEnum.enumValues)[number];

const agreementTransitions: Record<AgreementStatus, readonly AgreementStatus[]> = {
  draft: ["pending_internal_review", "ready_to_issue"],
  pending_internal_review: ["ready_to_issue", "draft"],
  ready_to_issue: ["issued"],
  issued: [
    "partially_accepted",
    "signatures_complete",
    "changes_requested",
    "declined",
    "expired",
    "voided",
  ],
  partially_accepted: [
    "signatures_complete",
    "changes_requested",
    "declined",
    "expired",
    "voided",
  ],
  signatures_complete: ["executed"],
  executed: [],
  changes_requested: ["draft"],
  declined: [],
  expired: [],
  voided: [],
};

export function assertAgreementTransition(from: AgreementStatus, to: AgreementStatus) {
  if (!agreementTransitions[from].includes(to))
    throw new Error("AGREEMENT_STATE_TRANSITION_INVALID");
}

export function assertRecipientCanAct(status: RecipientStatus) {
  if (status !== "available" && status !== "viewed")
    throw new Error("RECIPIENT_NOT_AVAILABLE");
}

export function assertEnvelopeOpen(status: EnvelopeStatus) {
  if (!["ready", "sent", "partially_completed"].includes(status))
    throw new Error("ENVELOPE_NOT_OPEN");
}
