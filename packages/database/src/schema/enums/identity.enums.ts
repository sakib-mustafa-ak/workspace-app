import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Provider that issued an `identity` (auth).
 *
 * Adding a new identity provider (Google, GitHub, Microsoft, Apple,
 * SAML…) only requires a new enum value plus a new IdentityProvider
 * implementation — never a schema change. The auth module never branches
 * directly on this value in business logic; that decision lives in the
 * provider registry.
 */
export const identityProviderEnum = pgEnum('identity_provider', [
  'EMAIL',
  'GOOGLE',
  'GITHUB',
  'MICROSOFT',
  'APPLE',
]);

export type IdentityProvider =
  (typeof identityProviderEnum.enumValues)[number];
