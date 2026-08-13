/**
 * Turbopack resolves `next` and linked workspace deps from this root.
 * pnpm keeps real packages in <repo>/.pnpm, so the root must be the
 * monorepo root, not apps/web.
 */
const monorepoRoot = new URL('../..', import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: monorepoRoot.pathname,
  },
  outputFileTracingRoot: monorepoRoot.pathname,
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

export default nextConfig;
