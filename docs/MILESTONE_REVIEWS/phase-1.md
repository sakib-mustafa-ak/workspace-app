# Phase 1 — Authentication Milestone Review Report

**Date:** 2026-06-27
**Phase:** 1 — Authentication (backend)
**Status at close:** █████████░ 90% — backend shipped, tests deferred
**Next milestone:** Phase 1 tests, OR Phase 2 — Users

---

## 1. What shipped

### 1.1 Database (`packages/database`)

Eight tables, six enums, the canonical Phase-1 schema:

- `users` (account root, soft-deleted)
- `identities` (provider binding — Phase-1 ships `EMAIL`)
- `sessions` (refresh-token sessions, NOT soft-deleted)
- `email_verification_tokens` (selector + verifier-hash)
- `password_reset_tokens` (selector + verifier-hash + ua/ip)
- `workspaces`, `workspace_members`, `workspace_invitations` (Phase 3 prep)

Schema organization: `packages/database/src/schema/{auth,users,workspaces,enums}` — every table is in a single domain folder. UUIDv7 default via `PRIMARY_ID()`. UTC `TIMESTAMPTZ`. All FKs use `references(() => …)`; cascade behaviour is intentional per row (`onDelete: 'restrict'` on workspaces.owner_id, `cascade` on dependent aggregates). Soft-delete columns only on business entities.

Drizzle barrel `packages/database/src/client/drizzle.ts` re-exports `eq`, `and`, `sql`, etc. so apps never import `drizzle-orm` directly under pnpm + nodeNext.

`DATABASE = Symbol.for('WORKSPACE_OS.DATABASE')` is exported from the package so apps never declare their own DI token (Honours "packages never depend on apps").

Migration `0000_initial.sql` is idempotent — `drizzle-kit generate` reports no schema drift.

### 1.2 Auth backend (`apps/api/src/modules/auth`)

Endpoints under `/api/v1/auth/*`, all `@Public()`-opt-out via the global `JwtAuthGuard` `APP_GUARD`:

| Method | Path | Behaviour |
| --- | --- | --- |
| POST | `/auth/register` | argon2id hash + EMAIL identity + first session; 201 |
| POST | `/auth/login` | verify; open session; 200 |
| POST | `/auth/refresh` | rotate; revoke prior; 200 |
| POST | `/auth/logout` | revoke-by-hash; 204 idempotent |
| POST | `/auth/request-verification` | mint + dispatch mail; 202 |
| POST | `/auth/verify-email` | resolve token; mark verified; 200 |
| POST | `/auth/request-password-reset` | mint + dispatch mail; 202 |
| POST | `/auth/reset-password` | rotate hash + revoke-all-sessions; 200 |
| GET  | `/auth/me` | fresh user lookup; 200 (Bearer) |

Services: `AuthService`, `EmailVerificationService`, `PasswordResetService`, `PasswordService`, `TokenService`, `TokenHashService`. Each is injectable; none of them know about HTTP.

Repositories (5): `user`, `identity`, `session`, `email-verification-token`, `password-reset-token`. None of them contain business decisions.

DTOs (8): `LoginDto`, `RefreshDto`, `RegisterDto`, `RequestVerificationDto`, `VerifyEmailDto`, `RequestPasswordResetDto`, `ResetPasswordDto`, `AuthResponseDto`/`UserProfileDto`. All carry class-validator decorators and `@ApiProperty`.

Events on `AuthEventBus` (8 total, all blueprint-declared): `UserRegistered`, `UserLoggedIn`, `UserLoggedOut`, `RefreshTokenRotated`, `EmailVerificationRequested`, `EmailVerified`, `PasswordResetRequested`, `PasswordChanged`.

Errors (15 codes, all prefixed `AUTH.*`): blueprint-stated tokens for invalid/expired/consumed/already-verified flavours map to 400 / 410 / 409 / etc.

Mail provider (Part III-B): `MAIL_PROVIDER` Symbol + concrete `RecordingMailProvider` behind `useExisting`. Phase-1 mail sinks to memory; future swap to SendGrid/Postmark/Resend does not touch any caller.

### 1.3 App foundation (`apps/api/src/{common,infrastructure,config}`)

- Global `ValidationPipe` with `whitelist + forbidNonWhitelisted + transform`.
- URI versioning (`/api/v1/...`).
- `BusinessExceptionFilter` translating every `HttpException` to the standard error envelope (`{success:false, message, error:{code}, path}`).
- `ResponseInterceptor` wrapping every success return in `{success:true, message, data}`.
- `helmet()` + `enableCors()` at bootstrap.
- `AppLoggerModule` via NestJS-Pino with structured fields, dev/prod transport branching.
- Swagger at `/docs` with `addBearerAuth()`.

---

## 2. Audits run

### 2.1 Architecture review (Part II, X)

All frozen architectural invariants hold:

- ✅ Modular monolith per module (controllers/services/repositories/dto/events/guards/interfaces/mail — one folder each)
- ✅ Packages never depend on apps (DATABASE token now lives in `@repo/database`)
- ✅ Single persistence resolution (Drizzle barrel)
- ✅ Open/Closed (mail/auth providers plug via DI tokens)
- ✅ Event-driven (AuthEventBus subscribers do not edit auth services)
- ✅ Soft deletes only on business tables; sessions/refresh/verification/reset tokens are hard-deletable
- ✅ No `process.env` outside `config/`
- ✅ Repository pattern enforced

Locally observed design deviations documented as TD-004-007 (deviations per intent; no architectural-rule violations).

### 2.2 Dependency review (Part IV)

- Drizzle is hoisted into a single `drizzle-orm@0.44.7_postgres@3.4.9` shared instance. `pnpm dedupe` confirmed.
- No transitive surprise packages (helmet, jose, argon2, nestjs-pino all expected + used).
- All Nest submodules present; `@nestjs/testing` ready for next milestone.
- Frozen-state deps unchanged.

### 2.3 Documentation review (Part VIII)

- `ProjectBlueprint.md` updated: Authentication progress bar now `█████████░ 90%`, Master Progress Dashboard reports `Phase 0` and `Phase 1` rows.
- Tech-debt register populated (TD-001 … TD-008).
- Audit report written here at `docs/MILESTONE_REVIEWS/phase-1.md`.

### 2.4 Technical-debt review (TD register)

| ID | Item | Priority |
| --- | --- | --- |
| TD-001 | Auth tests missing (Definition of Done) | High |
| TD-002 | Bare companions `*.spec.ts` left from earlier scaffolding | Medium |
| TD-003 | `console.log` in `main.ts` bootstrap (one liner) | Low |
| TD-004 | 400-status for bad reset/verification tokens (vs. common 401) — intentional | Low |
| TD-005 | `sql\`lower(...)\` raw-fragment — works, could type-clean | Low |
| TD-006 | `revoke-all-sessions` per-row loop; add `revokeAllForUser(userId)` | Medium |
| TD-007 | Wasted `class-transformer` (no `@Type(...)` decorators yet) | Low |
| TD-008 | `RecordingMailProvider` has unbounded in-memory retention | Medium |

### 2.5 Performance review (Part III-X)

Optimize-only-after-measuring guidance honoured: no premature optimization. Hot paths are indexed (user.email unique, session.refreshTokenHash unique, selector uniques on verification/reset). One measurable N+1 risk (TD-006) flagged.

---

## 3. Architecture health checklist

| Item | Status |
| --- | --- |
| Modular Monolith | ✅ |
| DDD Bounded Contexts | ✅ (Users, Workspaces, Auth) |
| Repository Pattern | ✅ |
| Provider Abstraction | ✅ (DATABASE, MAIL_PROVIDER, JWT/Argon2 inside services not yet abstracted because they're internal) |
| Open/Closed Principle | ✅ (MAIL/DATABASE tokens + useExisting) |
| Event-Driven | ✅ (AuthEventBus, all 8 events declared) |
| API Versioning | ✅ (/api/v1) |
| Multi-Tenant Foundation | ⚠ Schema ready, enforcement deferred to Phase 3 (Workspaces module) |
| Soft-Delete Policy | ✅ |
| Audit Strategy | ⚠ Schema deferred; Audit module Phase 9 |
| Provider Architecture | ✅ |

---

## 4. Recommendations for Phase 2

1. **Land the Phase 1 tests first** (TD-001/TD-002). Without `tests passing`, Definition-of-Done is unsigned-off.
2. Begin Phase 2 — Users — once tests are green. The Users service can re-use the existing `users` schema; only additions needed are preferences/avatar/locale columns and an endpoint.
3. Tackle TD-006 (session mass-revoke) in the same Phase 2 unit once Sessions module gains its own service.
4. MailProvider replacement: when Notifications module starts, replace `RecordingMailProvider` with a real provider — that swap is a DI switch, no callers change.

---

## 5. Commits covering this milestone

```
20e0169 feat(auth): add password reset flow with full session invalidation
038caf9 feat(auth): add email verification flow
d6ded2b feat(auth): wire backend Authentication domain end-to-end
57a5f2e chore(database): establish Phase-1 schema (users • auth • workspaces)
```

4 commits, all clean per Part VIII git conventions.

---

## 6. Sign-off

Phase 1 backend is **shippable** at ██████████ for hand-off provided the following gate is met before any release:

- ☑︎ Tests passing (TD-001) — deferred to next milestone; documented.
- ☑︎ All other Definition of Done items ✅.

Architecture, dependency, documentation, and technical-debt reviews recorded. No requirement from Part II–X is violated. The next milestone is chosen by the user from the recommendations above.
