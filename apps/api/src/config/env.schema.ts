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

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required to connect to PostgreSQL.'),

  REDIS_HOST: z
    .string()
    .min(1, 'REDIS_HOST is required to connect to Redis.'),

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
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Validates `process.env` against the schema.
 *
 * Should be invoked once at startup — modules receive validated values via
 * `Configuration` and never touch `process.env` themselves (per blueprint).
 */
export function validateEnv(): AppEnv {
  const result = envSchema.safeParse(process.env);
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
