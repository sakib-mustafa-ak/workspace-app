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
  private resend: Resend | null = null;
  private from: string;
  private readonly logger = new Logger(ResendMailProvider.name);

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('MAIL_FROM') ?? 'onboarding@resend.dev';
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not set — ResendMailProvider will throw if used.',
      );
    }
  }

  public async send(message: MailMessage): Promise<MailSendResult> {
    if (!this.resend) {
      throw new Error(
        'RESEND_API_KEY is not configured. Email delivery is unavailable.',
      );
    }
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
