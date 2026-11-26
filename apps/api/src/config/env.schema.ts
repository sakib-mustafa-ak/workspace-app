import { z } from 'zod';

/**
 * The single source of truth for environment variables.
 *
 * Why Zod here?
 * - Fails fast with a clear message when the environment is malformed.
 * - Generates a typed object we can hand to the rest of the app.
 * - Keeps validation next to the schema, in one file.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.string().default('4000'),

  APP_PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),

  // Comma-separated list of allowed browser origins for CORS. Defaults to
  // the public base URL when unset. Use "*" only in development.
  CORS_ORIGINS: z.string().default(''),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required to connect to PostgreSQL.'),

  REDIS_HOST: z.string().default('localhost'),

  REDIS_PORT: z.string().default('6379'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters.'),

  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters.'),

  JWT_ACCESS_TTL_SECONDS: z
    .string()
    .default('900')
    .refine((v) => /^\d+$/.test(v), {
      message: 'JWT_ACCESS_TTL_SECONDS must be an integer string.',
    }),

  JWT_REFRESH_TTL_SECONDS: z
    .string()
    .default('2592000')
    .refine((v) => /^\d+$/.test(v), {
      message: 'JWT_REFRESH_TTL_SECONDS must be an integer string.',
    }),

  // Upload storage. `local` writes to the API container's disk (dev only —
  // ephemeral on most hosts). `s3` targets any S3-compatible bucket
  // (AWS S3 or Cloudflare R2 via S3_ENDPOINT). `vercel-blob` targets a
  // Vercel Blob store using private blobs + signed URLs.
  STORAGE_DRIVER: z.enum(['local', 's3', 'vercel-blob']).default('local'),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Vercel Blob read-write token. Required when STORAGE_DRIVER=vercel-blob,
  // enforced in the superRefine below (fail fast at boot, not first upload).
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Explicit Gmail/Resend selection, with legacy Resend-key auto-selection.
  // Without either, only development/test may use the in-memory recorder.
  RESEND_API_KEY: z.string().trim().optional(),
  MAIL_PROVIDER: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['recorder', 'resend', 'gmail']).optional(),
  ),
  GMAIL_USER: z.string().trim().optional(),
  GMAIL_CLIENT_ID: z.string().trim().optional(),
  GMAIL_CLIENT_SECRET: z.string().trim().optional(),
  GMAIL_REFRESH_TOKEN: z.string().trim().optional(),
  MAIL_FROM: z.string().trim().optional(),
  DEV_MAIL_INBOX_ENABLED: z.enum(['true', 'false']).default('false'),

  // Optional: connectors stay unavailable until these are configured.
  PLUGIN_TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/, 'Use a base64-encoded 32-byte key.')
    .optional(),
  PLUGIN_GITHUB_CLIENT_ID: z.string().optional(),
  PLUGIN_GITHUB_CLIENT_SECRET: z.string().optional(),
  PLUGIN_SLACK_CLIENT_ID: z.string().optional(),
  PLUGIN_SLACK_CLIENT_SECRET: z.string().optional(),
  PLUGIN_GOOGLE_CLIENT_ID: z.string().optional(),
  PLUGIN_GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Error tracking. When SENTRY_DSN is set, runtimes capture exceptions to
  // Sentry; when absent, error tracking is disabled and the app runs normally.
  SENTRY_DSN: z.string().url().optional(),

  // Stripe billing (Phase 3). All optional at boot — billing simply stays
  // "not configured" — EXCEPT the pair rule enforced in the superRefine
  // below: a secret key must ship with a webhook secret, or signature
  // verification can never work.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_TEAM_MONTHLY: z.string().optional(),
});

// Cross-field rule: the s3 driver is useless (and fails at first upload,
// worst possible moment) without its connection settings — fail at boot.
const s3Fields = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
] as const;

export const envSchemaWithRefinements = envSchema.superRefine((env, ctx) => {
  const provider =
    env.MAIL_PROVIDER ?? (env.RESEND_API_KEY ? 'resend' : 'recorder');
  if (provider === 'gmail') {
    for (const field of [
      'GMAIL_USER',
      'GMAIL_CLIENT_ID',
      'GMAIL_CLIENT_SECRET',
      'GMAIL_REFRESH_TOKEN',
    ] as const) {
      if (!env[field])
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required for Gmail API delivery.`,
        });
    }
    if (!z.email().safeParse(env.GMAIL_USER).success)
      ctx.addIssue({
        code: 'custom',
        path: ['GMAIL_USER'],
        message: 'Set GMAIL_USER to the authorized sender email address.',
      });
    const sender =
      env.MAIL_FROM?.match(/^[^<>\r\n]+<([^<>\r\n]+)>$/)?.[1] ?? env.MAIL_FROM;
    if (sender && sender.toLowerCase() !== env.GMAIL_USER?.toLowerCase())
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_FROM'],
        message: 'Gmail MAIL_FROM must match GMAIL_USER.',
      });
  }
  if (provider === 'resend' && !env.RESEND_API_KEY)
    ctx.addIssue({
      code: 'custom',
      path: ['RESEND_API_KEY'],
      message: 'Resend requires RESEND_API_KEY.',
    });
  if (
    env.DEV_MAIL_INBOX_ENABLED === 'true' &&
    (env.NODE_ENV !== 'development' || provider !== 'recorder')
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['DEV_MAIL_INBOX_ENABLED'],
      message:
        'The local inbox is only allowed in development with the recorder provider.',
    });
  }
  if (env.NODE_ENV === 'production') {
    const sender =
      env.MAIL_FROM?.match(/^[^<>\r\n]+<([^<>\r\n]+)>$/)?.[1] ?? env.MAIL_FROM;
    if (provider === 'recorder')
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_PROVIDER'],
        message:
          'Production requires real email delivery. Configure Gmail or Resend.',
      });
    if (
      provider !== 'gmail' &&
      (!sender ||
        !z.email().safeParse(sender).success ||
        /@resend\.dev$/i.test(sender))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_FROM'],
        message: 'Set MAIL_FROM to an address on your verified sending domain.',
      });
    }
    const publicUrl = URL.canParse(env.APP_PUBLIC_BASE_URL)
      ? new URL(env.APP_PUBLIC_BASE_URL)
      : null;
    if (
      !publicUrl ||
      publicUrl.protocol !== 'https:' ||
      ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname) ||
      publicUrl.username ||
      publicUrl.password ||
      publicUrl.search ||
      publicUrl.hash
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_PUBLIC_BASE_URL'],
        message:
          'Production verification links require your public HTTPS web URL, without credentials, query or fragment.',
      });
    }
  }
  if (env.STORAGE_DRIVER === 's3') {
    for (const field of s3Fields) {
      if (!env[field]) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required when STORAGE_DRIVER=s3.`,
        });
      }
    }
  }

  if (env.STORAGE_DRIVER === 'vercel-blob' && !env.BLOB_READ_WRITE_TOKEN) {
    ctx.addIssue({
      code: 'custom',
      path: ['BLOB_READ_WRITE_TOKEN'],
      message:
        'BLOB_READ_WRITE_TOKEN is required when STORAGE_DRIVER=vercel-blob.',
    });
  }

  if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
    ctx.addIssue({
      code: 'custom',
      path: ['STRIPE_WEBHOOK_SECRET'],
      message:
        'STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set.',
    });
  }
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Validates `process.env` against the schema.
 *
 * Should be invoked once at startup — modules receive validated values via
 * `Configuration` and never touch `process.env` themselves (per blueprint).
 */
export function validateEnv(): AppEnv {
  const result = envSchemaWithRefinements.safeParse(process.env);
  if (!result.success) {
    const flat = result.error.flatten().fieldErrors;
    const messages = Object.entries(flat)
      .map(([field, errors]) => `  - ${field}: ${(errors ?? []).join(', ')}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${messages}\n\nSee apps/api/src/config/env.schema.ts for the contract.`,
    );
  }
  return result.data;
}
