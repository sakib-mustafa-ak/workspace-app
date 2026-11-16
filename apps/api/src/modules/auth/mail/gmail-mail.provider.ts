import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { randomUUID } from 'node:crypto';
import type {
  MailMessage,
  MailProvider,
  MailSendResult,
} from './mail.provider';

const DELIVERY_ERROR =
  'Email delivery is temporarily unavailable. Please try again shortly.';

/** Server-only Gmail OAuth transport. No SMTP, inbox-read scope, or automatic send retries. */
@Injectable()
export class GmailMailProvider implements MailProvider {
  private readonly logger = new Logger(GmailMailProvider.name);
  private token?: { value: string; expiresAt: number };
  private refreshing?: Promise<string>;

  constructor(private readonly config: ConfigService) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000)
      return this.token.value;
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.refreshAccessToken();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = undefined;
    }
  }

  private async refreshAccessToken(): Promise<string> {
    const clientId = this.config.get<string>('mail.gmail.clientId');
    const clientSecret = this.config.get<string>('mail.gmail.clientSecret');
    const refreshToken = this.config.get<string>('mail.gmail.refreshToken');
    if (!clientId || !clientSecret || !refreshToken)
      throw new Error(DELIVERY_ERROR);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) throw new Error(DELIVERY_ERROR);
    const result = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (
      !result.access_token ||
      !Number.isFinite(result.expires_in) ||
      result.expires_in! <= 0
    )
      throw new Error(DELIVERY_ERROR);
    this.token = {
      value: result.access_token,
      expiresAt: Date.now() + result.expires_in! * 1000,
    };
    return result.access_token;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    try {
      const from = this.config.get<string>('mail.from');
      const user = this.config.get<string>('mail.gmail.user');
      const sender = from?.match(/^[^<>\r\n]+<([^<>\r\n]+)>$/)?.[1] ?? from;
      if (
        !from ||
        !user ||
        /[\r\n]/.test(from) ||
        sender?.toLowerCase() !== user.toLowerCase() ||
        !isEmail(user) ||
        !isEmail(message.to) ||
        /[\r\n]/.test(message.to)
      )
        throw new Error(DELIVERY_ERROR);
      const boundary = `workspace_${randomUUID()}`;
      const encodeBody = (value: string) =>
        Buffer.from(value, 'utf8')
          .toString('base64')
          .match(/.{1,76}/g)
          ?.join('\r\n') ?? '';
      const part = (type: string, value: string) =>
        `Content-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${encodeBody(value)}`;
      const body = message.html
        ? `--${boundary}\r\n${part('text/plain', message.text)}\r\n--${boundary}\r\n${part('text/html', message.html)}\r\n--${boundary}--`
        : encodeBody(message.text);
      const mime = [
        `From: ${from}`,
        `To: ${message.to}`,
        `Subject: =?UTF-8?B?${Buffer.from(message.subject.replace(/[\r\n]/g, ' ')).toString('base64')}?=`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${randomUUID()}@${user.split('@')[1]}>`,
        'MIME-Version: 1.0',
        ...(message.html
          ? [`Content-Type: multipart/alternative; boundary="${boundary}"`]
          : [
              'Content-Type: text/plain; charset=UTF-8',
              'Content-Transfer-Encoding: base64',
            ]),
        '',
        body,
        '',
      ].join('\r\n');
      const token = await this.accessToken();
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: Buffer.from(mime).toString('base64url'),
          }),
        },
      );
      if (!response.ok) {
        if (response.status === 401) this.token = undefined;
        this.logger.warn(`Gmail send rejected (HTTP ${response.status})`);
        throw new Error(DELIVERY_ERROR);
      }
      const result = (await response.json()) as { id?: string };
      if (!result.id) throw new Error(DELIVERY_ERROR);
      return { messageId: result.id, acceptedAt: new Date() };
    } catch {
      // Never expose upstream response bodies, OAuth tokens, or message contents.
      throw new Error(DELIVERY_ERROR);
    }
  }
}
