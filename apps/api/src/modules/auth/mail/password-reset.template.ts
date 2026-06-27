/**
 * Render helpers for transactional mails sent from the auth domain.
 *
 * Mirrors `verification.template.ts` so a future Notifications module
 * can unify the rendering pipeline without changing call sites.
 */

export interface PasswordResetLinkTemplate {
  appBaseUrl: string;
  resetPath: string;
  selector: string;
  verifier: string;
  expiresInMinutes: number;
}

export interface RenderedPasswordResetMail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Compose both plain-text and HTML versions of the password-reset email.
 *
 * The plain-text version has the raw URL so terminal users and screen
 * readers see it; the HTML version is a small paragraph + anchor.
 */
export function renderPasswordResetMail(
  template: PasswordResetLinkTemplate,
): RenderedPasswordResetMail {
  const url = new URL(
    template.resetPath,
    ensureTrailingSlash(template.appBaseUrl),
  );
  url.searchParams.set('selector', template.selector);
  url.searchParams.set('verifier', template.verifier);

  const subject = 'Reset your Workspace OS password';

  const text = [
    'We received a request to reset your Workspace OS password.',
    '',
    'Open this link in your browser to choose a new password:',
    url.toString(),
    '',
    `This link expires in ${template.expiresInMinutes} minutes.`,
    'If you did not request this email, you can safely ignore it',
    '— your password will remain unchanged.',
    '',
    'For your safety, completing this reset signs out every device',
    'currently signed in to this account.',
  ].join('\n');

  const html = [
    '<p>We received a request to reset your Workspace OS password</p>',
    `<p><a href="${escapeHtml(url.toString())}">Reset my password</a</p>`,
    `<p><small>This link expires in ${template.expiresInMinutes} minutes</small</p>`,
    '<p><small>If you did not request this email, you can safely ignore it</small</p>',
    '<p><small>Completing this reset signs out every device currently signed in</small</p>',
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
 * Replace the five HTML-sensitive characters with safe entities.
 * const-coded via String.fromCharCode so the source does not visually
 * mimic the substitutions it makes. (See verification.template.ts.)
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, AMP_ENTITY)
    .replace(/</g, LT_ENTITY)
    .replace(/>/g, GT_ENTITY)
    .replace(/"/g, QUOT_ENTITY)
    .replace(/'/g, APOS_ENTITY);
}
