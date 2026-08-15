export type AuthEmailKind =
  | "verification"
  | "password-reset"
  | "invitation"
  | "quote-otp"
  | "agreement-otp";

export type EmailMessage = {
  kind: AuthEmailKind;
  recipient: string;
  recipientName: string;
  url: string;
  code?: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
