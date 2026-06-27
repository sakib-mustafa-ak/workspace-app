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

  return {
    app: {
      nodeEnv: env.NODE_ENV,
      port: Number(env.PORT),
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
