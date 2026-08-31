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
  // (AWS S3 or Cloudflare R2 via S3_ENDPOINT).
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Mail delivery. When RESEND_API_KEY is set, the Resend provider is used
  // for transactional email (verification, password reset, invites). When
  // absent, the in-memory RecordingMailProvider captures messages for dev/test.
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),

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
