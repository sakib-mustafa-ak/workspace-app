/**
 * Central schema exports.
 *
 * The Drizzle migration generator reads every table exported here.
 * Add new domains by re-exporting their `index.ts` below.
 *
 * Ordering does not matter at runtime; it does matter at the Drizzle
 * declaration site because foreign keys reference earlier tables.
 */

export * from './common.js';
export * from './enums/index.js';
export * from './users/index.js';
export * from './auth/index.js';
export * from './workspaces/index.js';
