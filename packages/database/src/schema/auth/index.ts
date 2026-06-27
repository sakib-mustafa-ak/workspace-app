/**
 * Public entry point for the auth schema.
 *
 * Domain-level constants (table names) and table definitions live in
 * their own files. This file exists so the root schema can wire the
 * whole aggregate through a single import.
 */

export * from './auth.constants.js';
export * from './identity.schema.js';
export * from './session.schema.js';
export * from './password-reset.schema.js';
export * from './email-verification.schema.js';
