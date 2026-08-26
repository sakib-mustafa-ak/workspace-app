# Workspace OS — Phase 0 Audit

**Date:** 2026-08-22
**Status:** Complete (read-only, no code changes)

---

## 1. Codebase Map

### Structure
```
workspace-app/           (pnpm monorepo + Turborepo)
├── apps/
│   ├── api/             NestJS 11 (16 domain modules)
│   └── web/             Next.js 16 (App Router)
├── packages/
│   ├── database/        Drizzle ORM + PostgreSQL (17 tables, 15 enums, 6 migrations)
│   ├── ui/              Shared React components (@repo/ui)
│   ├── eslint-config/   Shared ESLint
│   └── typescript-config/
├── render.yaml          Render deploy blueprint
└── docs/                Product/design/deployment docs
```

### Frontend (apps/web/)
- **Routing:** Next.js App Router — 20+ routes across auth, dashboard, workspaces, boards, canvas, settings, notifications, users, calendar
- **State:** React Context only (auth + toast). Canvas has its own useReducer. No zustand/redux. localStorage for tokens, theme, recent boards, recent profiles
- **API layer:** Custom `fetch()` wrapper with JWT auth, auto-refresh, response envelope unwrapping. 15 domain API modules in `lib/`
- **Components:** 17 shared components. No component library (no shadcn, no Radix)
- **Styling:** Tailwind CSS 4 with custom `surface-*` / `primary-*` / `warm-*` CSS variables. Geist Sans font. Custom dark/light theme via CSS variable overrides

### Backend (apps/api/)
- **Framework:** NestJS 11 with 16 domain modules
- **Auth:** JWT (jose library) + argon2id + refresh token rotation + session management
- **Validation:** Global `ValidationPipe` + class-validator DTOs on every route
- **Error handling:** Global `BusinessExceptionFilter` with stable machine-readable error codes
- **Logging:** pino (nestjs-pino) with structured JSON, request IDs
- **Rate limiting:** @nestjs/throttler (global 120/min, auth endpoints 10/min)
- **WebSocket:** Socket.IO for real-time canvas collaboration and notification delivery
- **Tests:** 29 spec files, all unit tests (no integration/E2E)

### Database (packages/database/)
- **Engine:** PostgreSQL via Drizzle ORM
- **Schema:** 17 tables, 15 enum types
- **PKs:** UUIDv7 (client-side generated)
- **Soft deletes:** Most tables have `deleted_at`
- **Indexes:** Every FK column indexed. Partial indexes for soft-delete patterns. CHECK constraints for business invariants
- **Migrations:** 6 sequential SQL migrations via drizzle-kit

---

## 2. Design Audit

### Typography
- **Font:** Geist Sans (local file, not Inter — this is good)
- **Type scale:** NONE — uses raw Tailwind defaults (`text-xs` through `text-2xl`). No modular scale, no deliberate hierarchy
- **`font-display`:** Maps to same Geist Sans (no contrast between display and body)

### Color
- **Custom palette:** `surface-*` (50-950), `primary-*` (50-900), `warm-*` (200-500). No default Tailwind slate/zinc
- **Dark mode:** Warm purple-gray surfaces. `surface-950: #121212`, `primary-500: #b9b0c8`
- **Light mode:** Inverted via `.light .className` overrides in CSS — fragile, bolted on, incomplete
- **Accent usage:** `warm-300` (#f2d98c) for user names. `primary-400/500` for interactive elements
- **No semantic tokens:** No `--color-success`, `--color-warning`, `--color-danger`, `--color-text-muted`, etc.

### Spacing & Density
- Standard Tailwind increments (`p-4`, `p-6`, `gap-3`). No custom spacing scale
- Density is inconsistent: some cards use `p-4`, others `p-5`, `p-6` — no deliberate density mode

### Elevation & Depth
- No elevation system. Cards use `border border-surface-800` for separation
- Auth pages have animated blur circles (`blur-3xl`) as ambient effects
- No shadow hierarchy — only `shadow-lg` on primary buttons and `hover:shadow-lg` on some cards

### Iconography
- **Lucide React** exclusively — no emoji as icons. This is consistent and good
- `WorkspaceLogo` is a custom SVG (purple gradient with overlapping diamonds)

### Border Radius
- `rounded-lg` (8px) for buttons, inputs, smaller cards
- `rounded-xl` (12px) for larger cards and panels
- `rounded-2xl` (16px) for top-level cards (auth forms, user detail)
- `rounded-full` for avatars, badges
- Limited variation — somewhat formulaic

### Empty States (16 total)
- **Designed (4):** Dashboard workspaces, boards list, workspace boards tab — icon + title + description + CTA
- **Minimal (12):** Plain text only — "No notifications", "No upcoming tasks", "No comments yet", etc.

### Loading States
- **Skeletons (3):** Dashboard workspace list (shimmer), users list (pulse), user detail (full skeleton)
- **Spinners (12+):** Bare `<Loader2>` or circular border spinner everywhere else
- No skeleton states for boards, workspace content, comments, files

### Error States
- **Consistent pattern:** Inline red banners (`border-red-500/20 bg-red-500/10 text-red-400`)
- **Panel style:** For page-level errors with "Try again" CTA
- **Banner style:** For form-level errors
- Toast for background notifications
- Error boundary for catastrophic failures

### Micro-Interactions
- **Hover states:** `hover:border-surface-700`, `hover:bg-surface-800/50`, `hover:-translate-y-0.5` on task cards
- **Focus rings:** Only on inputs (`focus:border-primary-500`). Buttons lack visible focus indicators
- **Transitions:** `transition-colors` on most interactive elements. `transition-all` on primary buttons
- **Missing:** `hover:-translate-y-0.5` on SortableTaskCard has no `transition-transform`
- **Animations:** `slideUp`, `fadeIn`, `shimmer`, `slideIn`, `fadeUp`, `drift` — all respect `prefers-reduced-motion`

### Responsive
- **Mobile:** Sidebar becomes overlay with hamburger + bottom tab bar. Background images swap via `sm:hidden`
- **Gaps:** `px-8` hardcoded in workspace/board headers (no mobile reduction). Board columns use fixed `w-72` with horizontal scroll

### Accessibility
- `aria-label`, `aria-expanded`, `title` on interactive elements
- `prefers-reduced-motion` respected
- Keyboard shortcuts: `g d` (dashboard), `g n` (notifications), `g s` (settings), `g u` (users)
- **Missing:** Keyboard navigation for boards/tasks, ARIA roles on custom components, WCAG AA contrast verification

### AI-Generated Tells
1. **Repetitive card pattern** — nearly every card is `rounded-xl border border-surface-800 bg-surface-900`. No visual hierarchy variation
2. **Inconsistent empty states** — 4 designed, 12 plain text
3. **Inconsistent loading states** — 3 skeletons, 12+ spinners
4. **Light mode bolted on** — manual `.light .className` overrides instead of CSS variable inversion
5. **No focus ring system** — only inputs get focus indicators
6. **Missing transition on hover-lift** — `hover:-translate-y-0.5` without `transition-transform`
7. **Duplicated code** — `getPasswordStrength` in register + reset-password. `Section` wrapper in each settings tab
8. **Inline `<style>` tag** in `authenticated-layout.tsx`
9. **Inconsistent button hierarchy** — `active:scale-[0.98]` on some CTAs, not others
10. **`confirm()` (browser native)** used alongside custom `ConfirmModal` — inconsistent UX

---

## 3. Backend Audit

### Auth Flow — STRENGTH
- **Password hashing:** argon2id (19MB memory, 2 iterations, 1 parallelism) — tuned for 70-250ms
- **JWT:** `jose` library, HS256, separate secrets for access (15min) and refresh (30 days)
- **Refresh token rotation:** Mandatory — verifies, mints new pair, replaces hash atomically. Old sessions never reused
- **Timing safety:** Constant-time dummy hashing on failed login to prevent timing attacks
- **Password reset:** Selector + verifier pattern. On consumption: rotates hash, revokes ALL live sessions
- **Email verification:** Selector + verifier pattern, 24h TTL, 202 response to prevent account enumeration

### Validation — STRENGTH
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Every DTO uses class-validator decorators (`@IsEmail`, `@MinLength`, `@IsEnum`, `@IsUUID`, etc.)
- **Minor:** Push subscription endpoint uses inline body type instead of DTO class

### Error Handling — STRENGTH
- Global `BusinessExceptionFilter` — catches ALL exceptions
- Non-HttpException errors return generic "Internal server error" (no DB details leaked)
- Stable machine-readable error codes per module (`AUTH.INVALID_CREDENTIALS`, `TASKS.NOT_FOUND`)
- Auth errors have well-thought-out HTTP status mappings (410 Gone for expired tokens)

### Database Indexes — STRENGTH
- Every FK column has a dedicated index
- Partial indexes for soft-delete patterns
- Compound indexes for common query patterns
- CHECK constraints enforce business invariants at DB level
- Proper `ON DELETE RESTRICT` vs `CASCADE` usage

### N+1 Queries — CRITICAL ISSUE
- **Search service:** O(N*M) query pattern — fetches memberships, then queries boards per workspace, then tasks per board. For 5 workspaces × 10 boards × 20 tasks = 56 queries per search request
- **Boards service:** Sequential `findById` + `requireRole` calls per column operation
- **Tasks list:** `workspaceName` field always empty (incomplete join)

### Rate Limiting — GOOD (with caveat)
- Global 120 req/min per IP
- Auth endpoints: 10 req/min
- Invitation endpoints: 20 req/min
- Upload endpoints: 30 req/min
- **Caveat:** In-memory storage — won't work across multiple API instances (acknowledged in code comments)

### Logging — STRENGTH
- pino with structured JSON in production, pretty-print in dev
- Request IDs (`req_{timestamp}_{random}` or from `X-Request-Id` header)
- Custom log levels (5xx → error, 4xx → warn, 2xx → info)
- Request/response serializers strip sensitive data

### Test Coverage — WEAKNESS
- 29 spec files, ALL unit tests
- Controller tests: mock services, verify method calls
- Service tests: mock repositories, test business logic
- **No integration tests:** No HTTP requests against test DB
- **No E2E tests:** Validation pipe, error filter, guards not tested end-to-end

### Guards & Middleware
- `JwtAuthGuard` (global, protected-by-default): queries DB on every request to check user status — performance concern
- `ThrottlerGuard` (global): rate limiting
- Policy classes (service-layer authorization): TaskPolicy, BoardPolicy, WorkspacePolicy, CommentPolicy, etc.
- `helmet()` for HTTP security headers
- **Missing:** `BoardsController.getById()` and `WorkspacesController.getById()` lack `@CurrentUser()` / membership check

### API Conventions
- URI versioning: `/api/v1/<resource>`
- Consistent HTTP methods and status codes (POST 201, GET 200, PATCH 200, DELETE 204)
- Response envelope: `{ success, data, message }` / `{ success, message, error: { code } }`
- **Inconsistency:** Comments not nested under workspace path (unlike tasks)
- Full Swagger/OpenAPI documentation

---

## 4. Gap List (SaaS Requirements)

| Requirement | Status | Notes |
|---|---|---|
| **Multi-tenancy / Organizations** | Present | Workspaces exist with members, roles, invitations. Data scoped per workspace at query level. |
| **Roles & Permissions (RBAC)** | Partial | 5 roles defined (OWNER/ADMIN/EDITOR/COMMENTER/VIEWER). Policy classes exist per module. But enforcement is service-layer only, not all mutations checked. |
| **Invitations** | Present | Email-based invitations with pending state, expiring links, role assignment. Full flow: create → email → accept → membership created. |
| **Billing & Subscriptions** | Missing | No Stripe integration. No pricing tiers. No checkout flow. No usage limits. |
| **Onboarding** | Missing | No first-run experience. New users dropped into blank dashboard. No sample data. No guided tour. |
| **Notifications (in-app)** | Present | Notification center with list, unread count, mark read, archive. Real-time via WebSocket. Push notifications via Web Push API. |
| **Notifications (email)** | Missing | `notification_channel` enum has `EMAIL` value but no email sending service wired. |
| **Settings (workspace)** | Present | Edit name/description, manage members, invitations, archive/delete. Full settings page. |
| **Settings (personal)** | Present | Profile, security (password + sessions), preferences (timezone/locale), danger zone (delete account). |
| **Admin / Back-office** | Missing | No admin view. No impersonation. No subscription status view. |
| **Audit Log** | Present | `audit_events` table with workspace_id, user_id, action, resource_type, resource_id, metadata. Activity tab on workspace page. |
| **Search** | Partial | Search endpoint exists (`/v1/search`) but has O(N*M) N+1 query problem. Returns boards + tasks. No full-text search. |
| **Real-time** | Present | Socket.IO for canvas collaboration (presence, object sync). Notification delivery via WebSocket. |
| **Email Verification** | Present | Full flow: register → email → verify link → verified. Selector + verifier pattern. |
| **Password Reset** | Present | Full flow: request → email → reset link → new password. Session revocation on reset. |
| **Rate Limiting** | Present | Global + per-endpoint. In-memory only (won't scale horizontally). |
| **Structured Logging** | Present | pino with request IDs, structured JSON, sensitive data stripping. |
| **Error Tracking** | Missing | No Sentry or similar wired. |
| **CI/CD** | Partial | Husky hooks for commit lint. No CI pipeline visible (no GitHub Actions). |
| **Testing** | Partial | 29 unit test files. No integration/E2E tests. |
| **Marketing Site** | Missing | Root `/` redirects to login. No public-facing landing page. |
| **Legal Pages** | Missing | No Terms of Service or Privacy Policy. |
| **Performance Audit** | Not done | Bundle size, image optimization, query perf not assessed. |

---

## 5. Summary

### What the codebase does well
1. **Auth architecture** — arguably production-grade (argon2id, JWT rotation, timing safety, session revocation)
2. **Error handling** — comprehensive, consistent, no info leakage
3. **Database design** — extensive indexing, CHECK constraints, proper FK behavior
4. **Logging** — structured, request-scoped, production-ready
5. **Validation** — global pipe, DTO decorators, whitelist + reject extras
6. **Module architecture** — clean boundaries, repository pattern, event-driven design
7. **Custom color system** — not default Tailwind, intentional palette
8. **Iconography** — consistent Lucide usage, custom logo

### Critical issues to fix
1. **Search N+1** — O(N*M) queries will break at scale
2. **No integration tests** — entire backend untested end-to-end
3. **No billing** — can't call this a SaaS without it
4. **No onboarding** — new users get a blank dashboard
5. **No email notifications** — `EMAIL` channel exists but isn't wired
6. **No admin view** — no way to manage accounts
7. **No marketing site** — just a login page
8. **No legal pages** — ToS and Privacy Policy required

### What was deliberately NOT assessed
- Performance audit (bundle size, image optimization, query perf) — deferred to Phase 4
- CI/CD pipeline details — deferred to Phase 4
- Canvas conflict resolution quality — deferred to Phase 3
- Third-party account requirements (Stripe, email service) — flagged for user decision
