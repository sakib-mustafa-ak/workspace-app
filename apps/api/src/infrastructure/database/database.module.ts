import { Global, Module } from '@nestjs/common';
import { DATABASE, db, type Db } from '@repo/database';

/**
 * Provides the singleton Drizzle-backed database connection as a global
 * injectable, under the typed token `DATABASE`.
 *
 * Why global?
 * - Every repository depends on a single shared connection.
 * - Modules don't need to import infrastructure just to get a handle.
 * - Future read-replicas can be registered as separate tokens without
 *   changing consumer code.
 *
 * The token (`DATABASE`) and the connection itself (`db`) are both
 * owned by `@repo/database` (infrastructure package). This module
 * only wires them into the DI container — never declaring its own,
 * to honour the blueprint rule "Packages never depend on applications."
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useValue: db as Db,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
