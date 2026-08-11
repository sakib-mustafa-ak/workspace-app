# Feature: Auth

Email + password accounts with JWT sessions, email verification, and password reset. Scaffolded for OAuth identity providers (Google/GitHub) but not yet enabled.

## What it does

- Register/login with email + password (argon2 password hashing).
- Access token (JWT, 15 min) + refresh token (30 d) with rotation.
- Email verification via `selector` + `verifier` token links.
- Password reset via short-lived tokens (1h default).
- Session per device; logout revokes the session; refresh rotates the hash.

## Endpoints

See `docs/api/routes.md` — `/auth/*` (register, login, refresh, logout, request-verification, verify-email, request-password-reset, reset-password, me). Everything except `/auth/me` is `[public]`.

## Tables

`users`, `identities`, `sessions`, `email_verification_tokens`, `password_reset_tokens` (see `docs/database/schema.md`).

## Flow notes

- Refresh tokens are never stored in plaintext: only a SHA-256 hash lives in `sessions.refresh_token_hash`; rotation creates a new hash; `revoked_at` marks explicit logout; stale sessions are purged by a retention job.
- Password hashes live on `users.password_hash` today; `identities.password_hash` is reserved per the identity-provider design so future OAuth users share one home.
- Tokens are hard-deleted after consumption/expiry (no soft delete on sessions or tokens).
- In dev, verification/reset links are returned in API responses (email delivery is a stub).

## Status

OAuth (`GOOGLE`, `GITHUB`, `MICROSOFT`, `APPLE` enum values) is scaffolded at the schema level only — provider flows are not implemented. Email delivery needs a real provider before launch (see `docs/launch-checklist.md`).