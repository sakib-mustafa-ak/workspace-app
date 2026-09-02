import * as Sentry from '@sentry/nestjs';

/**
 * Initialize Sentry for the API.
 *
 * Pure and argument-driven so this infra file never reads `process.env`
 * directly (see the repo convention: env vars are read only in
 * `apps/api/src/config/*`). Callers pass values already sourced from
 * `ConfigService`. No-op when no DSN is provided, so local/test runs stay
 * clean and don't emit network calls.
 */
export function initSentry(dsn: string | undefined, environment: string): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment,
    release: 'workspace-api@0.1.0',
    tracesSampleRate: 0.2,
  });
}
