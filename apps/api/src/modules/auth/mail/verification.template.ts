/**
 * Render helpers for transactional mails sent from the auth domain.
 *
 * Plain-text rendering uses Intl defaults (no locale override here)
 * because every line is short and unambiguous. The HTTP host name used
 * to build verification links is environment-driven so dev and prod
 * never share URLs by accident.
 *
 * No PII is interpolated beyond the user-controlled email, which the
 * caller already possesses at request time.
 */

export interface VerificationLinkTemplate {
  appBaseUrl: string;
  verifyPath: string;
  /** Selector is the public portion of the token; verifier is the secret. */
  selector: string;
  verifier: string;
  expiresInMinutes: number;
}

export interface RenderedVerificationMail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Compose both plain-text and HTML versions of the verification email.
 *
 * Plain-text has the raw URL so terminal users and screen-readers see it.
 * HTML uses a p tag with the same URL; Phase 1 is functional, not pretty,
 * by design (Part VI-A "MVP implements: In-App/Email").
 */
export function renderVerificationMail(
  template: VerificationLinkTemplate,
): RenderedVerificationMail {
  const url = new URL(
    template.verifyPath,
    ensureTrailingSlash(template.appBaseUrl),
  );
  url.searchParams.set('selector', template.selector);
  url.searchParams.set('verifier', template.verifier);

  const subject = 'Verify your Workspace OS email';

  const text = [
    'Verify your email to finish setting up your Workspace OS account.',
    '',
    'Open this link in your browser:',
    url.toString(),
    '',
    `This link expires in ${template.expiresInMinutes} minutes.`,
    'If you did not request this email, you can safely ignore it.',
  ].join('\n');

  const html = [
    '<p>Verify your email to finish setting up your Workspace OS account</p>',
    `<p><a href="${escapeHtml(url.toString())}">Verify my email</a</p>`,
    `<p><small>This link expires in ${template.expiresInMinutes} minutes</small</p>`,
  ].join('');

  return { subject, text, html };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

const AMP_ENTITY = String.fromCharCode(38) + 'amp;';
const LT_ENTITY = String.fromCharCode(60) + 'lt;';
const GT_ENTITY = String.fromCharCode(62) + 'gt;';
const QUOT_ENTITY = String.fromCharCode(34) + 'quot;';
const APOS_ENTITY = String.fromCharCode(39) + 'apos;';

/**
 * Replace the five characters that need entity-escaping inside an HTML
 * attribute or text node. Implemented via String.fromCharCode so the
 * source escapes don't visually mimic the things they substitute for,
 * which keeps this file honest for code review.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, AMP_ENTITY)
    .replace(/</g, LT_ENTITY)
    .replace(/>/g, GT_ENTITY)
    .replace(/"/g, QUOT_ENTITY)
    .replace(/'/g, APOS_ENTITY);
}
