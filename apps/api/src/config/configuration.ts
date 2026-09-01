import { validateEnv } from './env.schema.js';

/**
 * The only module allowed to read `process.env`.
 *
 * Validation runs at load time so the rest of the system can rely on
 * strongly typed configuration objects. Other layers inject values
 * via `ConfigService` and never read `process.env` directly.
 */
export function configuration() {
  const env = validateEnv();

  // CORS allowlist: explicit CORS_ORIGINS wins; otherwise fall back to the
  // public base URL. Splitting on commas and trimming keeps `.env` friendly.
  const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [env.APP_PUBLIC_BASE_URL];

  return {
    app: {
      nodeEnv: env.NODE_ENV,
      port: Number(env.PORT),
      publicBaseUrl: env.APP_PUBLIC_BASE_URL,
      corsOrigins,
    },

    database: {
      url: env.DATABASE_URL,
    },

    redis: {
      host: env.REDIS_HOST,
      port: Number(env.REDIS_PORT),
    },

    auth: {
      jwt: {
        access: {
          secret: env.JWT_ACCESS_SECRET,
          ttlSeconds: Number(env.JWT_ACCESS_TTL_SECONDS),
        },
        refresh: {
          secret: env.JWT_REFRESH_SECRET,
          ttlSeconds: Number(env.JWT_REFRESH_TTL_SECONDS),
        },
      },
    },

    storage: {
      driver: env.STORAGE_DRIVER,
      s3:
        env.STORAGE_DRIVER === 's3'
          ? {
              endpoint: env.S3_ENDPOINT as string,
              region: env.S3_REGION as string,
              bucket: env.S3_BUCKET as string,
              accessKeyId: env.S3_ACCESS_KEY_ID as string,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
            }
          : null,
      blob:
        env.STORAGE_DRIVER === 'vercel-blob'
          ? { token: env.BLOB_READ_WRITE_TOKEN as string }
          : null,
    },

    billing: {
      stripeSecretKey: env.STRIPE_SECRET_KEY,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      priceProMonthly: env.STRIPE_PRICE_PRO_MONTHLY,
      priceTeamMonthly: env.STRIPE_PRICE_TEAM_MONTHLY,
    },
  };
}

export type AppConfig = ReturnType<typeof configuration>;
