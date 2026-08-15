import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { ProviderConnection } from "@/modules/inbox/application/ports";
import type { NormalizedInboundEvent } from "@/modules/inbox/domain/canonical";
import { chooseEmailThread, normalizeMessageId } from "./threading";

export type EmailConnectionConfig = {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  mailbox: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password: string;
  from: string;
};
export class EmailAdapter {
  readonly channel = "email" as const;
  constructor(private readonly config: EmailConnectionConfig) {}
  async verifyConnection() {
    const client = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapSecure,
      auth: { user: this.config.username, pass: this.config.password },
      logger: false,
    });
    try {
      await client.connect();
      await client.mailboxOpen(this.config.mailbox);
      return true;
    } finally {
      await client.logout().catch(() => undefined);
    }
  }
  async syncOnce(connection: ProviderConnection): Promise<NormalizedInboundEvent[]> {
    const client = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapSecure,
      auth: { user: this.config.username, pass: this.config.password },
      logger: false,
    });
    const events: NormalizedInboundEvent[] = [];
    try {
      await client.connect();
      const lock = await client.getMailboxLock(this.config.mailbox);
      try {
        for await (const message of client.fetch(
          { seen: false },
          { envelope: true, source: true, uid: true },
        )) {
          const envelope = message.envelope;
          const id =
            normalizeMessageId(envelope?.messageId) ??
            `${this.config.mailbox}:${message.uid}`;
          const from = envelope?.from?.[0]?.address ?? id;
          events.push({
            channel: this.channel,
            connectionId: connection.id,
            externalEventId: id,
            conversationId: normalizeMessageId(envelope?.inReplyTo) ?? id,
            participantId: from,
            participantName: envelope?.from?.[0]?.name,
            address: from,
            messageId: id,
            kind: "text",
            text: envelope?.subject ?? "Correo recibido",
            providerTimestamp: envelope?.date,
          });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
    return events;
  }
  async send(input: {
    to: string;
    subject: string;
    text: string;
    inReplyTo?: string;
    references?: string[];
  }) {
    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: { user: this.config.username, pass: this.config.password },
    });
    const result = await transporter.sendMail({
      from: this.config.from,
      to: input.to,
      subject: input.subject.replace(/[\r\n]/g, " "),
      text: input.text,
      inReplyTo: normalizeMessageId(input.inReplyTo) ?? undefined,
      references: input.references
        ?.map((value) => normalizeMessageId(value))
        .filter(Boolean)
        .join(" "),
    });
    return {
      externalMessageId: normalizeMessageId(result.messageId) ?? crypto.randomUUID(),
    };
  }
  chooseThread(
    input: { inReplyTo?: string; references?: string[]; subject?: string },
    known: Array<{ id: string; externalThreadId: string; subject?: string | null }>,
  ) {
    return chooseEmailThread(input, known);
  }
}
