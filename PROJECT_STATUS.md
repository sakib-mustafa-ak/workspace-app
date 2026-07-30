# Workspace App — Project Status
**Date**: 2026-07-28
**Branch**: main
**Latest Commit**: d63cee3 — "feat(notifications): add NotificationHandler + Policy, wire up domain event listeners"

## Build & Test Status

| Check | Status |
|-------|--------|
| Build | ✅ Pass (2/2: api, web) |
| Lint | ✅ Pass (3/3: api, web, ui) |
| Tests | ✅ 193/193 pass (25 suites) |
| Check-types | ✅ web + ui (api has no check-types script) |

## Project Structure

```
workspace-app/
├── apps/
│   ├── api/          → NestJS backend (12 modules)
│   └── web/          → Next.js 16 frontend (8 route groups)
├── packages/
│   ├── database/     → Drizzle ORM, PostgreSQL schema, migrations
│   ├── ui/           → Shared UI components
│   ├── eslint-config/
│   └── typescript-config/
├── docker/
└── docs/
```

## API Modules (apps/api/src/modules/)

| Module | Status | Has Tests |
|--------|--------|-----------|
| auth | ✅ Complete | ✅ |
| users | ✅ Complete | ✅ |
| workspaces | ✅ Complete | ✅ |
| boards | ✅ Complete | ✅ |
| tasks | ✅ Complete | ✅ |
| comments | ✅ Complete | ✅ |
| notifications | ✅ Backend done, E2E shows only TASK_ASSIGNED delivering | ✅ 9 handler tests |
| health | ✅ Complete | ✅ |
| canvas | 🔶 Scaffolded, untracked | ❌ |
| realtime | 🔶 Scaffolded, untracked | ❌ |
| uploads | 🔶 Scaffolded, untracked | ❌ |

## Frontend Routes (apps/web/app/)

| Route | Status |
|-------|--------|
| /auth/login, /auth/register, /auth/verify-email, /auth/reset-password, /auth/request-password-reset | ✅ |
| /dashboard | ✅ |
| /notifications | ✅ (frontend) |
| /settings | ✅ |
| /users, /users/[id] | ✅ |
| /workspaces/[workspaceId] | ✅ |
| /workspaces/[workspaceId]/boards | ✅ |
| /workspaces/[workspaceId]/boards/[boardId] | ✅ |
| /workspaces/[workspaceId]/boards/[boardId]/canvas | 🔶 Scaffolded, untracked |
| /workspaces/invitations/accept | ✅ |

## Uncommitted Changes

### Modified (tracked)
- `apps/api/src/modules/notifications/notifications.module.ts` — DI fix (imports domain modules instead of direct providers)
- `apps/api/src/modules/notifications/handlers/notification.handler.ts` — 7 event handlers, creator skip, BOARD_ARCHIVED type fix
- `apps/api/src/modules/boards/boards.module.ts` — exports BoardsRepository
- `apps/api/src/modules/workspaces/workspaces.module.ts` — exports WorkspaceMembersRepository
- `apps/api/src/app.module.ts` — includes canvas, uploads, realtime modules
- `packages/database/src/schema/enums/notification.enums.ts` — added BOARD_ARCHIVED
- `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/page.tsx` — frontend changes
- `apps/web/lib/api.ts` — API client updates

### Untracked (new files)
- `apps/api/src/modules/canvas/` — Full canvas module (controllers, services, events, policies, repositories)
- `apps/api/src/modules/realtime/` — WebSocket gateway scaffold
- `apps/api/src/modules/uploads/` — File upload module (controllers, services, providers)
- `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/` — Canvas frontend
- `apps/web/lib/canvas.ts`, `apps/web/lib/uploads.ts` — Frontend API clients
- `packages/database/src/schema/canvas/` — Canvas DB schema (canvas_objects, canvas tables)
- `packages/database/src/schema/uploads/` — Uploads DB schema (uploaded_files table)
- `packages/database/src/schema/enums/canvas.enums.ts` — Canvas enums
- Migrations: 0001, 0002, 0004 (BOARD_ARCHIVED)
- `docs/superpowers/`

## Known Issues

1. **E2E notification gap**: Only TASK_ASSIGNED delivers. BOARD_SHARED, MEMBER_ADDED, COMMENT_ADDED don't appear. All failing handlers query `listByWorkspace()` which filters `deletedAt IS NULL`. `Notification handlers registered` appears 0 times in dev server log — `onModuleInit()` may not be running.

2. **@Public() bug**: `workspaces.controller.ts:acceptInvitation` has `@Public()` decorator that skips auth guard, but `@CurrentUser()` returns `undefined`. Need to either remove `@Public()` or pass userId through the DTO.

3. **Canvas, Realtime, Uploads modules**: Scaffolded but not integrated/tests not added.

## Notification System Details

- Handlers: handleBoardCreated (skip creator), handleBoardArchived (BOARD_ARCHIVED fix), handleCommentCreated, handleTaskCreated, handleMemberAdded, handleInvitationAccepted, handleFileUploaded
- Handler test file: `notification.handler.spec.ts` — 9 tests, all passing
- NotificationsModule imports: BoardsModule, CommentsModule, TasksModule, WorkspacesModule, UploadsModule
- Event buses: BoardsEventBus, CommentsEventBus, TasksEventBus, WorkspacesEventBus, UploadsEventBus

## README Roadmap Progress

| Phase | Status |
|-------|--------|
| Phase 1 — Foundation | Mostly done (Docker Infrastructure and Redis unchecked) |
| Phase 2 — Authentication | Mostly done (OAuth/SSO unchecked) |
| Phase 3 — Workspaces | ✅ Complete |
| Phase 4 — Boards | ✅ Complete |
| Phase 5 — Tasks | ✅ Complete |
| Phase 6 — Comments | ✅ Complete |
| Phase 7 — Notifications | ✅ Complete |
| Phase 8 — Real-Time Collaboration | ⬜ Not started |
| Phase 9 — Productivity (Documents, File Uploads) | 🔶 File uploads scaffolded |
| Phase 10 — AI | ⬜ Not started |
