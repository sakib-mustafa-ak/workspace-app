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
export * from './boards/index.js';
export * from './tasks/index.js';
export * from './comments/index.js';
export * from './notifications/index.js';
export * from './canvas/index.js';
export * from './uploads/index.js';
export * from './audit/index.js';
export * from './checklists/index.js';
export * from './billing/index.js';
