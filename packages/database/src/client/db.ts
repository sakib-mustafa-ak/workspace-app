import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Singleton connection to PostgreSQL using postgres-js + Drizzle.
 *
 * The connection string is sourced exclusively from `DATABASE_URL`.
 * The fallback here is purely a development convenience; production
 * will throw at startup if the env var is missing (the API enforces
 * this via its config validator).
 *
 * `DB` is the raw Drizzle handle; consumers should inject it via the
 * `DATABASE` token (see below) rather than importing `db` directly,
 * so swapping connection strategies later stays inside this package.
 */
export type Db = PostgresJsDatabase<Record<string, never>>;

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://workspace:workspace123@localhost:5433/workspace';

const client = postgres(connectionString, {
  // Keep pool small by default — workers scale horizontally.
  max: 10,
});

export const db: Db = drizzle(client);

/**
 * Injection token used by Nest's DatabaseModule to expose the singleton
 * Drizzle connection through DI without forcing every repository to
 * import the concrete `db` symbol.
 *
 * Why a Symbol?
 * - Type-safe at compile time (no string collisions possible).
 * - Refactor-safe: renaming databases does not break consumers.
 * - Injectable via `@Inject(DATABASE)`.
 *
 * Why does the token live in the database package and not the API?
 * The blueprint is explicit: "Packages never depend on applications."
 * Owning the token here keeps that direction correct and lets future
 * apps (workers, scripts, second backend) reuse the same wiring.
 */
export const DATABASE = Symbol.for('WORKSPACE_OS.DATABASE');
