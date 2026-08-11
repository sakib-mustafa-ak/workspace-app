# System Overview

Workspace OS is a pnpm monorepo: a NestJS REST + WebSocket API, a Next.js web app, and shared packages.

## Repo layout

```
apps/
  api/          NestJS API (REST + Socket.IO) — port 4000
  web/          Next.js web app (App Router) — port 3000
packages/
  database/     Drizzle schema, migrations, db client
  (shared)      other shared packages as added
docs/           decisions, domain model, roadmap, feature docs
```

## Apps

### `apps/api` — NestJS
Entry: `src/main.ts` boots:
- global prefix `/api/v1`, URI versioning (default `v1`)
- `helmet`, CORS enabled
- static assets from `./uploads` at `/uploads/*` (dev)
- global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`)
- global `BusinessExceptionFilter` + `ResponseInterceptor` (`{ success, message, data }` envelope)

Modules (`src/modules`): `auth`, `users`, `workspaces`, `boards`, `tasks`, `checklists` (checklist items), `comments`, `canvas`, `notifications`, `realtime`, `uploads`, `search`, `ai`, `audit`, `health`.

Supporting `src/infrastructure`: `database` (Drizzle + PostgreSQL; PGlite in tests), `redis` (queues/messaging), `logger`.

Cross-cutting `src/common`: guards (global JWT guard; `@Public()` opt-outs), decorators (`@CurrentUser()`), policies/roles, exceptions, filters, interceptors, pipes, responses, utils.

**Realtime:** Socket.IO gateway in `modules/realtime/gateways/canvas.gateway.ts` handles canvas collaboration rooms per board (`board:join` / `board:leave`) and broadcasts `cursor:move`, `object:created|updated|deleted`, `object:lock|unlock`. Presence and locks are tracked per room; canvas writes persist via the canvas sync service, high-frequency move/resize frames broadcast without a DB write per frame.

**Domain events:** modules emit typed events (e.g. notifications `events/`); the notification handlers subscribe and create in-app notifications.

### `apps/web` — Next.js
App Router; server-side session-aware pages. Main surfaces:
- `/` dashboard (recent workspaces/boards, tasks)
- `/workspaces` + `/workspaces/[id]` (members, invitations, settings)
- boards: Kanban (`/workspaces/[id]/boards/[boardId]`) with drag-drop columns, task dialogs, comments, checklists, calendar view toggle
- canvas: `/workspaces/[workspaceId]/boards/[boardId]/canvas` (linked from the board page) — shape tool palette, sticky notes, text, images, zoom/pan, realtime presence/cursors via Socket.IO at `:4000/canvas` namespace, undo/redo
- notifications center (in-app feed, unread badge)
- settings pages (profile, workspace settings)

## Packages

### `packages/database`
Drizzle schema per aggregate (see `docs/database/schema.md`), enums as Postgres `pgEnum`, `common.ts` helpers (`PRIMARY_ID` UUIDv7, `CREATED_AT`/`UPDATED_AT`, `DELETED_AT`, `TOUCH_UPDATED_AT_SQL`). Client helpers + migrations live here.

## Data flow

1. Request hits API → global auth guard validates Bearer JWT (access token, 15 min TTL) → controller → service (business rules) → repository (Drizzle) → PostgreSQL.
2. Writes that matter to multiple users (canvas, comments, tasks, notifications) emit domain events/realtime broadcasts.
3. Web app talks to the API over `/api/v1` (REST) and Socket.IO (`http://localhost:4000`) for realtime.

## Cross-cutting conventions

- Soft delete is selective; tokens/sessions are hard-deleted by sweep jobs.
- Auth: JWT access + refresh rotation; refresh tokens stored hashed (SHA-256) in `sessions`.
- Permissions: policies (see `docs/domain/04-permissions.md`); role hierarchy VIEWER < COMMENTER < EDITOR < ADMIN < OWNER.
- Envelope errors: business exceptions → `{ success: false, message, ... }` via the global filter.
- Tests: API unit/integration tests run with PGlite; `pnpm --filter api test` (see `docs/standards/code-style.md`).

## Gaps / notes

- File storage is local disk today (`provider = 'local'`); object storage (R2) is planned — see `docs/launch-checklist.md`.
- AI endpoints exist but board summarize still feeds sample data (see `docs/features/ai.md`).
- Email delivery is a stub (verification/reset links returned in dev responses).

Design history: `docs/decisions/*.md` (monorepo, PostgreSQL, Drizzle, Next.js), full blueprint in `docs/ProjectBlueprint.md`.