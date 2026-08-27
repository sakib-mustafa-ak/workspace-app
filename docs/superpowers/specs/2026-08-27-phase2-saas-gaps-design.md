# Phase 2 Design: Closing Remaining SaaS Gaps

Date: 2026-08-27
Status: Approved (pending spec review)
Supersedes: n/a
Related: 2026-08-22-phase0-audit.md

## Context

The Phase 0 audit and subsequent hardening phases closed security, realtime,
design-system, and CI gaps. This phase closes the remaining items from the
original SaaS Gap List that are not billing (billing is Phase 3):

1. Finish audit log coverage
2. Fix search performance
3. Decide on push notifications
4. Persist active-workspace context
5. Notification preferences
6. Minimal admin/back-office
7. Onboarding flow

## Decisions Locked in Brainstorming

Seven judgment calls were presented and approved:

| # | Call | Decision |
|---|------|----------|
| 1 | Push notifications | **Delete** the dead scaffold |
| 2 | Search scope | Keep results at **boards + tasks** (no expansion) |
| 3 | Active workspace persistence | **localStorage** per-user key |
| 4 | Admin audit | Dedicated **`admin_audit_log`** table |
| 5 | Onboarding sample board | **Opt-in**, not default |
| 6 | Mention email pref | Pref row exists but is **inert** (no mention feature ships) |
| 7 | Subscription status | **Stubbed constant** |

---

## 1. Audit Log Coverage

### Current state

`audit_events` table is generic (`action` text, `resourceType` text,
`resourceId` text nullable, `metadata` jsonb, `workspaceId` NOT NULL FK).
Handlers exist for workspace, member, invitation, board, column events via
the event-bus pattern (`OnModuleInit` subscribe → `audit.record()`).

Task, comment, upload, and canvas event buses exist but have **no audit
handler**. Their events are only consumed by the notifications handler.

### Design

Add four handlers mirroring `board-audit.handler.ts`, registered in
`audit.module.ts`, subscribing to existing event buses:

| Handler | Bus | Events audited |
|---------|-----|----------------|
| `task-audit.handler.ts` | `TasksEventBus` | `task.created`, `task.updated`, `task.moved`, `task.deleted` |
| `comment-audit.handler.ts` | `CommentsEventBus` | `comment.created`, `comment.deleted` |
| `upload-audit.handler.ts` | `UploadsEventBus` | `file.uploaded`, `file.deleted` |
| `canvas-audit.handler.ts` | `CanvasEventBus` | `canvas.object.created`, `canvas.object.updated`, `canvas.object.deleted`, `canvas.cleared` |

Event payloads already carry `workspaceId` and `createdBy`/actor — verify
each bus payload before wiring; extend payloads only if a field is genuinely
missing (prefer existing data).

`resourceType` uses singular nouns consistent with existing conventions
(`task`, `comment`, `file`, `canvas`, `canvas_object`).

### Testing

Unit tests for each handler: mock the event bus, publish an event, assert
`audit.record` called with correct row. Match existing handler test style
(see `board-audit.handler` tests if present, else `notification.handler`
spec patterns).

---

## 2. Search → Postgres Full-Text

### Current state

`SearchService.searchGlobal(userId, query)` loads all boards and all tasks
per workspace into memory and filters with JS `.toLowerCase().includes()`.
N+1 queries (`listByBoard` per board). Membership scoping via
`workspace_members.listByUser()` first — preserved.

### Design

- Add **generated `tsvector` columns** to `boards` and `tasks`:
  - `boards`: `search_vector` from `name` and `description`
  - `tasks`: `search_vector` from `title`
- Add **GIN indexes** on both.
- Migration: new file `0006_search_vectors.sql` (generated via
  `drizzle-kit generate` if supported, else hand-written to match Drizzle
  migration style). Generated columns in Postgres are `STORED` — evaluated
  on write, maintained automatically.

SQL shape (per workspace, or a single query joined across membership):

```sql
WHERE search_vector @@ websearch_to_tsquery(:query)
```

Use `websearch_to_tsquery` for user-friendly syntax (quotes, `-`, `OR`).

Rewrite `searchGlobal`:
1. Resolve `workspaceIds` scoped to the user (unchanged).
2. Run indexed queries against `boards` and `tasks` with `@@` tsquery,
   joined to `workspace_members` for scoping (defense-in-depth even though
   workspaceIds already scoped).
3. Return same shape `{ query, boards, tasks }` — frontend unchanged.
4. Limit result counts (e.g. 20 each) and order by `ts_rank` descent.

Config: `english` text search config; `websearch_to_tsquery` on the query
string; skip GIN on empty/odd input gracefully (empty query returns empty).

### Testing

- Unit tests with mocked repo returning filtered rows.
- Favor a small integration-style SQL test if DB harness permits; otherwise
  assert the query paths used. Matching existing spec style acceptable.
- Preserve membership scoping (already tested by existing search spec).

---

## 3. Push Notifications — Delete

### Current state (dead scaffold)

- `WebPushService.configure()` never called → `this.configured` always
  `false` → every `sendNotification()` throws; error silently swallowed at
  `push-subscriptions.service.ts:94-100`.
- `apps/web/public/sw.js` never registered; references non-existent icons.
- `use-push-notifications.ts` imported nowhere.
- VAPID keys read via `process.env` directly, violating the config contract.

### Design — remove all of it

Delete:

- `apps/api/src/modules/notifications/services/web-push.service.ts`
- `apps/api/src/modules/notifications/services/push-subscriptions.service.ts`
- `apps/api/src/modules/notifications/controllers/push-subscriptions.controller.ts`
- `apps/api/src/modules/notifications/repositories/push-subscriptions.repository.ts`
- `apps/api/scripts/generate-vapid-keys.ts`
- `apps/web/public/sw.js`
- `apps/web/hooks/use-push-notifications.ts`
- `push_subscriptions` table + schema + migration entry (new migration
  `0006_drop_push_subscriptions.sql` with `DROP TABLE`)
- `sendToUser` branch in notifications delivery path
- VAPID env entries in `render.yaml`, `.env.example`
- `web-push` npm dependency
- Any `PushSubscriptionsModule`/provider references in
  `notifications.module.ts` and `realtime.module.ts`

Keep the in-app notification row + socket fan-out channels untouched.

### Testing

Build + relevant module specs pass; grep asserts no `sw.js`, `VAPID`,
`pushManager`, `push_subscriptions` references remain in app code.

---

## 4. Persist Active Workspace

### Current state

Nothing persists active workspace. Login/register → always `/dashboard`.
Sidebar derives active workspace from URL pathname. Switcher writes nothing.
Switcher's "All workspaces" link → `/workspaces` which **404s** (no index
route).

### Design

- New hook `useActiveWorkspace` (client):
  - Key: `lastActiveWorkspace:<userId>` in localStorage.
  - Persist current `workspaceId` when the user navigates within a
    workspace (sidebar/URL effect) — single source of truth in the sidebar
    effect that already syncs `activeWorkspaceId` from pathname.
  - Expose `getLastActiveWorkspace(userId)`, `setLastActiveWorkspace(...)`.
- On `login()` and `register()`: after redirect to `/dashboard`, check for a
  persisted workspace; if the user still has access (validate against the
  fetched workspace list), redirect to `/workspaces/{id}`. Simplest robust
  spot: a small effect in the authenticated layout or in `auth-context`
  after the dashboard mounts. Recommend: handle in `auth-context.login()`
  and `register()` by reading the workspace list + stored id once, then
  `router.replace`.
- Fix 404: point the sidebar "All workspaces" entry at `/dashboard`
  (dashboard already lists workspaces).
- Keep `/dashboard` as the fallback when no persisted workspace exists.

### Testing

Light: unit test the localStorage helpers; manual/component verification of
the redirect path is acceptable given the client-only nature.

---

## 5. Notification Preferences

### Current state

No preference table. `MENTION_CREATED` / `WORKSPACE_UPDATED` enum values
exist but nothing emits them. Email (`ResendMailProvider`) fires only for
email verification and password reset — never for notifications.

### Design

**Schema** — new table `notification_preferences`:

| column | type |
|--------|------|
| `user_id` | uuid PK, FK → users (cascade) |
| `type` | `notification_type` enum, part of composite PK |
| `email_enabled` | boolean, default true |
| `in_app_enabled` | boolean, default true |
| `updated_at` | timestamptz |

Composite primary key `(user_id, type)`. New users get a default row set
via user-registration transaction (or deferred; see note) — simplest:
seed on demand (upsert) on first preferences read for any absent type.

**API** (under users module):
- `GET /users/me/notification-preferences` → full list for the 10 enum
  types.
- `PUT /users/me/notification-preferences` → body array of
  `{ type, emailEnabled, inAppEnabled }`, upsert.
- Guarded by existing JWT auth + self-only.

**UI** — new "Notifications" section in
`apps/web/app/settings/preferences-tab.tsx`:
- One row per notification type with email + in-app toggles.
- Matches the existing two-option form's save pattern (`PATCH /users/me`).
- Language: user-facing labels per type (e.g. "Email me when I'm
  assigned to a task").

**Email delivery** — add EMAIL channel to the notification handler flow:
- On `invitation.created` (to invited user) and `task.assigned` (to
  assignee): if that user's `email_enabled` pref for the corresponding
  type is true, send via `ResendMailProvider` before/alongside creating the
  in-app row.
- Reuse the `MAIL_PROVIDER` DI token already used by auth mail flows.
- `MENTION_CREATED` pref row ships but stays inert (no mention feature).

### Testing

- Repository/service tests for upsert + default seeding.
- Controller spec for GET/PUT validation + self-guard.
- Notification handler: mock mail provider + prefs service; assert mail
  sent when enabled and skipped when disabled, for invite and assignment.

---

## 6. Minimal Admin / Back-Office

### Current state

No platform-level role. `users` table has no admin flag. Audit table is
workspace-scoped (`workspaceId` NOT NULL). JWT `role` claim exists but is
hardcoded `'USER'` and ignored for authorization.

### Design

**Schema** (migration `0006` alongside push drop):
- `users.is_admin` boolean NOT NULL DEFAULT false.
- Surface in `CurrentUser` interface.
- Set JWT `role` claim from DB (`ADMIN`/`USER`) — still never trusted alone;
  `@AdminGuard` re-checks DB.

**Guard** — `@AdminGuard` in `apps/api/src/modules/auth/guards/` (or a new
admin guard file). Checks `CurrentUser`/DB `is_admin`. Applied to the admin
controller.

**Admin audit** — new table `admin_audit_log`:

| column | type |
|--------|------|
| `id` | uuid PK |
| `actor_id` | uuid FK → users (restrict) |
| `action` | text (e.g. `user.looked_up`, `workspace.looked_up`, `user.impersonated`) |
| `target_type` | text (`user` / `workspace`) |
| `target_id` | uuid |
| `metadata` | jsonb default `{}` |
| `created_at` | timestamptz |

Not tied to a workspace — separate from `audit_events` by design.

**API** — new `AdminModule` under `/v1/admin/`:
- `GET /users?query=` — email or ID lookup (paginated, minimal fields)
- `GET /users/:id`
- `GET /workspaces?query=` — name/slug/ID lookup
- `GET /workspaces/:id`
- `GET /users/:id/subscription` — **stub**: returns
  `{ plan: 'free', status: 'active', note: 'stubbed — billed in Phase 3' }`
- `POST /users/:id/impersonate` — checks target is ACTIVE, records
  `admin_audit_log` (action `user.impersonated`, actor, target), returns a
  signed access token bound to the target user carrying
  `{ sub, role, impersonatorId }`; frontend stores it as the active token
  and routes to `/dashboard`.
- `POST /impersonation/end` — clears frontend impersonation state and
  returns to `/admin`. (Token itself is a standard access token; ending
  impersonation is client-side token replacement — no server session
  exists given stateless JWTs. Audit row records the start; document that
  token expiry bounds impersonation duration.)

**UI** — `/admin` route in web app:
- Minimal layout (own header, "Exit impersonation" link when active).
- List user by email/ID; list workspace by name/ID; view stubbed
  subscription; "Log in as" button on each user row.
- Client-guarded (hide nav entry unless `isAdmin`) but **server-enforced** —
  the API 401/403s non-admins regardless of UI.
- Clear "internal tool" framing in the UI.

**Impersonation UX flag:** this is a real security-sensitive path. Must be
audit-logged (done above), reject self-impersonation, reject impersonating
another admin, and evidence the audit row is written **before** returning
the token.

### Testing

- Guard spec: non-admin → 403.
- Audit service: every admin action records a row.
- Impersonation: 403 on self/admin target; writes audit row; returns token
  with correct claims.

---

## 7. Onboarding Flow

### Current state

Register/login → `/dashboard`. Zero-workspace users see the dashboard empty
state ("No workspaces yet" + create form). No wizard exists. Workspace and
board creation are inline forms already; APIs exist.

### Design

- **Trigger:** after `register()` (always) and after `login()` (when user
  has zero workspaces) → `/onboarding`. When the user already has a
  workspace, skip onboarding (`/onboarding` self-redirects to `/dashboard`
  if `workspaces.length > 0`).
- **Route:** `apps/web/app/onboarding/page.tsx`, 3 steps, **skippable at
  every step** (X / "Skip for now"):
  1. Create workspace — reuses `CreateWorkspaceForm` logic (name/slug),
     calls existing workspaces API.
  2. Invite teammates — email list + role, optional; skip allowed.
  3. Done — checkbox "Create a sample board" (default **off**); either
     creates a sample board via existing boards API or not; button → land
     on `/workspaces/{id}` (board list with existing empty-state CTA).
- After step 1 a workspace always exists → step 3 landing is deterministic.
- Integrates with the new active-workspace persistence: landing sets
  `lastActiveWorkspace` so the sidebar starts on the new workspace.

### Testing

Component/render tests for step transitions and skip guards; redirect logic
test if a harness exists; otherwise manual verification.

---

## Cross-Cutting Concerns

### Concurrency / task ordering

Design doc-level conflict review noted at plan time. Key ordering:
- Search vectors migration (`0006`) and push-drop migration (`0006`) are the
  SAME migration number — resolve by combining into one `0006` or generating
  two distinct files (`0006_search_vectors`, `0007_drop_push`). Prefer
  distinct sequential files via `drizzle-kit generate` where possible.
- Notification preferences and admin/onboarding are independent of audit
  and search.

### Config / env

- Remove `VAPID_*` from `render.yaml` and `.env.example`.
- No new secrets this phase.
- `MAIL_PROVIDER` reused for notification email; no new mail config needed.

### Security

- Admin is platform-level, DB-checked, never token-trusting.
- Impersonation audit-logged before token issuance; self/admin
  impersonation forbidden.
- Search rewrite must not regress membership scoping.

## Out of Scope

- Billing/subscriptions (stub only) — Phase 3
- Mentions feature (enum + pref row only)
- Web push rebuild
- Expanded search surface (workspaces/members/files)
- Marketing/legal site, onboarding wizard for existing paid tiers

## Open Questions

None — all seven judgment calls approved.