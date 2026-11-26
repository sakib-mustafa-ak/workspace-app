import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// OAuth callback URLs contain short-lived authorization codes. Do not start
// browser telemetry on this page before the callback removes its query string.
if (dsn && !window.location.pathname.startsWith('/plugins/callback/')) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  });
}
