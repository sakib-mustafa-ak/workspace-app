import { withSentryConfig } from '@sentry/nextjs/config';
import process from 'node:process';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/v1/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:4000/uploads/:path*',
      },
    ];
  },
};

// Source maps upload and build-time Sentry features are opt-in via
// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN; without them the build runs
// normally and no upload occurs. Runtime error capture/tracing still work when
// a DSN is configured.
export default withSentryConfig(nextConfig, {
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
