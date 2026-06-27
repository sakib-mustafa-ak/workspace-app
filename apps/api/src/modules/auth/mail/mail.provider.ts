import { Injectable } from '@nestjs/common';

/**
 * Provider-agnostic mail transport.
 *
 * Why an interface (Part III-B `Provider Abstraction`):
 *   - AuthService stays free of any vendor SDK.
 *   - New providers (SendGrid, Postmark, SES, Resend, …) plug by
 *     registering a different Nest provider behind this token —
 *     no edits to business logic.
 *   - Tests inject an in-memory recorder without mocking third-party
 *     clients.
 *
 * The token `MAIL_PROVIDER` is the DI key every caller resolves.
 */
export const MAIL_PROVIDER = Symbol.for('WORKSPACE_OS.MAIL_PROVIDER');

/**
 * One outbound mail item.
 *
 * `text` is offered so future providers that cannot render HTML
 * (e.g. some transactional-only APIs) still work; `html` is offered
 * so rich templates in the Notifications module can render.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Inbound-event style.
 *
 * Production providers return:
 *  - `messageId` (SMTP/Id, etc.) for cross-tracking with delivery callbacks.
 *  - `acceptedAt` when the provider accepted the request.
 *
 * The RecordsMailProvider below returns deterministic mocks.
 */
export interface MailSendResult {
  messageId: string;
  acceptedAt: Date;
}

/**
 * Recording in-memory `MailProvider` for Phase 1.
 *
 * The blueprint defers real SMTP egress to a future milestone (Notifications).
 * For Phase 1 the choice is between:
 *  (a) a no-op that swallows emails       → unverifiable behaviour
 *  (b) a recorder that retains them in memory → tests can assert, mail
 *                                               can be flushed later
 *
 * We pick (b). Production-ready mail egress should swap this provider
 * via DI override without touching any caller.
 */
@Injectable()
export class RecordingMailProvider {
  private readonly outbox: MailMessage[] = [];

  /**
   * Send the message; record it for inspection by tests/dev tooling.
   * Real providers translate `MailMessage` to their SDK shape and
   * return the upstream's `messageId`; here we mint one locally.
   */
  public async send(message: MailMessage): Promise<MailSendResult> {
    this.outbox.push(message);
    const messageId =
      `mail_local_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
    return {
      messageId,
      acceptedAt: new Date(),
    };
  }

  /** Used by tests to assert what was sent. Production call sites never call this. */
  public flush(): MailMessage[] {
    return this.outbox.splice(0, this.outbox.length);
  }

  /** Read-only access for diagnostics without draining the buffer. */
  public snapshot(): readonly MailMessage[] {
    return [...this.outbox];
  }
}
