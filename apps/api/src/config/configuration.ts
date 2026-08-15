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
  };
}

export type AppConfig = ReturnType<typeof configuration>;
