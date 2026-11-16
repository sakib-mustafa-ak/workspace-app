import { Inject, Injectable } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import { domainToASCII } from 'node:url';
import { isEmail } from 'class-validator';
import { AuthErrorCode, AuthException } from '../errors/auth.errors';

export const EMAIL_DNS = Symbol('EMAIL_DNS');

export interface EmailDns {
  acceptsMail(domain: string): Promise<boolean>;
}

/** Shared by signup, login and recovery. DNS is checked only during signup. */
export function normalizeEmailAddress(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 0) return trimmed;
  return `${trimmed.slice(0, at)}@${domainToASCII(trimmed.slice(at + 1))}`;
}

function dnsCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : '';
}

/** Only DNS queries; never connects to user-supplied SMTP hosts or probes mailboxes. */
@Injectable()
export class MailDomainDns implements EmailDns {
  async acceptsMail(domain: string): Promise<boolean> {
    const resolver = new Resolver({ timeout: 1500, tries: 2 });
    // Bound the entire MX + address-fallback lookup, not just each DNS packet.
    const timeout = setTimeout(() => resolver.cancel(), 4500);
    try {
      let mx: Awaited<ReturnType<Resolver['resolveMx']>> = [];
      try {
        mx = await resolver.resolveMx(domain);
      } catch (error) {
        if (dnsCode(error) === 'ENOTFOUND') return false;
        if (dnsCode(error) !== 'ENODATA') throw error;
      }
      // RFC 7505 null MX explicitly says the domain accepts no mail.
      if (
        mx.some((record) => record.exchange === '.' || record.exchange === '')
      )
        return false;
      if (mx.length) return true;
      // RFC 5321 implicit MX: no MX may still mean delivery to A/AAAA.
      const results = await Promise.allSettled([
        resolver.resolve4(domain),
        resolver.resolve6(domain),
      ]);
      if (
        results.some(
          (result) => result.status === 'fulfilled' && result.value.length > 0,
        )
      )
        return true;
      const temporary = results.find(
        (result) =>
          result.status === 'rejected' &&
          !['ENODATA', 'ENOTFOUND'].includes(dnsCode(result.reason)),
      );
      if (temporary?.status === 'rejected') throw temporary.reason;
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}

@Injectable()
export class EmailDomainService {
  constructor(@Inject(EMAIL_DNS) private readonly dns: EmailDns) {}

  async validateAddress(input: string): Promise<string> {
    if (typeof input !== 'string') throw this.invalid();
    const email = normalizeEmailAddress(input);
    const at = email.lastIndexOf('@');
    const domain = email.slice(at + 1);
    if (
      at <= 0 ||
      email.length > 254 ||
      !isEmail(email, {
        allow_ip_domain: false,
        allow_utf8_local_part: false,
        require_tld: true,
      })
    )
      throw this.invalid();
    let acceptsMail: boolean;
    try {
      acceptsMail = await this.dns.acceptsMail(domain);
    } catch {
      // A DNS outage is retryable, not evidence that a person's address is fake.
      throw new AuthException(
        AuthErrorCode.EMAIL_CHECK_UNAVAILABLE,
        'We could not check your email domain right now. Please try again shortly.',
      );
    }
    if (!acceptsMail) throw this.invalid();
    return email;
  }

  private invalid() {
    return new AuthException(
      AuthErrorCode.INVALID_EMAIL_DOMAIN,
      'Enter a valid email address with a domain that can receive email. Check for spelling mistakes.',
    );
  }
}
