import { z } from "zod";

export const envSchema = z.object({
  PORT: z.string().default("4000"),

  DATABASE_URL: z.string(),

  REDIS_HOST: z.string(),

  REDIS_PORT: z.string(),

  NODE_ENV: z.enum([
    "development",
    "production",
    "test",
  ]),
});