import nodemailer, { type Transporter } from "nodemailer";
import { getEnvironment } from "@/infrastructure/config/env";
import type {
  EmailMessage,
  EmailSender,
} from "@/modules/identity/application/ports/email-sender";
import { buildAuthEmail } from "./templates";

export class SmtpEmailSender implements EmailSender {
  private transporter: Transporter | undefined;
  private pending = new Set<Promise<void>>();

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const environment = getEnvironment();
      this.transporter = nodemailer.createTransport({
        host: environment.SMTP_HOST,
        port: environment.SMTP_PORT,
        secure: environment.SMTP_SECURE,
      });
    }

    return this.transporter;
  }

  async send(message: EmailMessage): Promise<void> {
    const delivery = this.deliver(message);
    this.pending.add(delivery);
    void delivery.finally(() => this.pending.delete(delivery)).catch(() => undefined);
    return delivery;
  }

  async waitForPending(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }

  private async deliver(message: EmailMessage): Promise<void> {
    const environment = getEnvironment();
    const content = buildAuthEmail(message);

    await this.getTransporter().sendMail({
      from: environment.SMTP_FROM,
      to: message.recipient,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }
}

export const emailSender = new SmtpEmailSender();

export function sendInvitationEmail(input: {
  recipient: string;
  recipientName: string;
  url: string;
  appBaseUrl: string;
}): void {
  const parsedUrl = new URL(input.url);
  if (parsedUrl.origin !== new URL(input.appBaseUrl).origin) {
    throw new Error("El enlace de invitacion usa un origen no permitido.");
  }

  void emailSender
    .send({
      kind: "invitation",
      recipient: input.recipient,
      recipientName: input.recipientName,
      url: parsedUrl.toString(),
    })
    .catch(() => {
      console.error("[tenancy] fallo al enviar invitacion");
    });
}
