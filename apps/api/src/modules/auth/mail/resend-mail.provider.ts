import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { type MailMessage, type MailSendResult } from './mail.provider';

/**
 * Production-ready mail provider backed by Resend (resend.com).
 *
 * Only instantiated when `RESEND_API_KEY` is set; otherwise the
 * RecordingMailProvider is used for dev/test. This is controlled
 * in auth.module.ts via the MAIL_PROVIDER token.
 */
@Injectable()
export class ResendMailProvider {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logger = new Logger(ResendMailProvider.name);

  constructor(config: ConfigService) {
    this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    this.from = config.getOrThrow<string>('MAIL_FROM');
  }

  public async send(message: MailMessage): Promise<MailSendResult> {
    const result = await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (result.error) {
      this.logger.error(
        { to: message.to, error: result.error },
        'Resend delivery failed',
      );
      throw new Error(`Mail delivery failed: ${result.error.message}`);
    }

    return {
      messageId: result.data?.id ?? `resend_${Date.now()}`,
      acceptedAt: new Date(),
    };
  }
}
