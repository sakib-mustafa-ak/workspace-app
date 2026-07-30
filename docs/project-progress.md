# Workspace App — Project Progress

## What Was Built

A full-stack collaborative workspace SaaS platform with a NestJS backend, Next.js frontend, PostgreSQL database (via Drizzle ORM), and Redis pub/sub.

### Backend (apps/api — NestJS 11, TypeScript)

**Modules (15 total):**

| Module | Status | Tests | Key Files |
|--------|--------|-------|-----------|
| auth | Complete | 5 specs | JWT access/refresh tokens, email verification, password reset, session management, registration/login |
| users | Complete | 3 specs | CRUD, profile update, admin user listing/deletion |
| workspaces | Complete | 1 spec | CRUD, member management, role-based access (Owner/Admin/Member), invitations |
| boards | Complete | 1 spec | CRUD, columns, archive/unarchive, templates, export |
| tasks | Complete | 3 specs | CRUD, status lifecycle (Todo→InProgress→Done), priority levels, assignee, move between columns |
| comments | Complete | 3 specs | Threaded comments on boards, edit/delete with ownership policy |
| notifications | Complete | 2 specs | Full lifecycle (Created→Queued→Delivered→Read→Archived), 7 domain event handlers, WebSocket push scaffold |
| health | Complete | 2 specs | Readiness/liveness checks |
| audit | Complete | 1 spec | Activity log for workspaces and boards |
| checklists | Complete | — | CRUD on tasks |
| search | Complete | 1 spec | Global search across entities |
| canvas | Scaffolded | — | Canvas object CRUD, policies, socket gateway scaffold |
| realtime | Scaffolded | — | WebSocket gateway with Socket.IO |
| uploads | Scaffolded | — | File upload with pluggable storage provider (local implementation) |
| ai | Scaffolded | — | AI provider interface, Gemini provider implementation |

**Cross-cutting:**
- ResponseInterceptor wrapping all responses as `{ success, data, message }`
- BusinessException filter for domain errors
- Event bus pattern across all modules (BoardsEventBus, TasksEventBus, etc.)
- Authorization policy guards (BoardPolicy, TaskPolicy, etc.)
- Redis pub/sub for real-time events

### Frontend (apps/web — Next.js 16, React, Tailwind CSS)

**Route Groups (8):**

| Route | Status | Features |
|-------|--------|----------|
| /auth/* | Complete | Login, register, email verification, password reset flow, request verification |
| /dashboard | Complete | Real workspace stats (member/board counts), invitations banner, activity feed |
| /settings | Complete | Profile tab, security (password change), preferences (theme toggle), danger zone (delete account) |
| /notifications | Complete | Paginated list with filter tabs (All/Unread/Archived), dropdown with 15s polling |
| /users, /users/[id] | Complete | User listing, profile detail page |
| /workspaces/[workspaceId] | Complete | Overview tab, boards tab, members tab, invitations tab, activity tab, settings tab |
| /workspaces/*/boards | Complete | Board list, Kanban board detail with task cards, drag-and-drop columns |
| /workspaces/*/boards/*/canvas | Scaffolded | Canvas with object rendering, selection, layers panel, toolbar, context menu, WebSocket sync |

**Shared Components:**
- Sidebar with search, workspace switcher, user menu
- Authenticated layout wrapper
- Notifications dropdown (badge count, real-time polling)
- Toast notification context
- Confirm modal dialog
- Error boundary
- Task modal with assignee, due date, priority, checklist, comments
- Sortable task cards (drag-and-drop)
- Email verification banner
- AI ideas dialog, AI summarize panel
- Comments panel
- Board file sidebar, board upload button

**Hooks & Utilities:**
- `useAuth` — auth context provider
- `useTheme` — light/dark theme with cookie persistence (hydration-safe)
- `useKeyboardShortcuts` — keyboard shortcut registry
- `useCanvas` / `useCanvasSocket` — canvas state + WebSocket sync
- `api.ts` — HTTP client with ResponseInterceptor unwrap, token refresh

### Database (packages/database — Drizzle ORM, PostgreSQL)

**Schema tables:** users, identities, sessions, email_verification_tokens, password_reset_tokens, workspaces, workspace_members, invitations, boards, board_columns, tasks, board_comments, notifications, canvas_objects, uploaded_files, audit_logs, checklists

**Migrations:** 0000 (initial), 0001 (canvas + uploads), 0002 (notifications), 0003 (audit + checklists)

## How It Was Built

### Architecture Philosophy
- **Monorepo** managed by TurboRepo + pnpm workspaces
- **Modular backend** — each feature is a self-contained NestJS module (controller, service, repository, policy, events, DTOs)
- **Event-driven** — domain events decouple modules (e.g., board creation triggers notification via BoardsEventBus)
- **Frontend-backend contract** via `ResponseInterceptor` wrapper pattern — all API responses are `{ success, data, message }`

### Key Technical Decisions
- **POSTGRES_HOST=localhost with port 5433** — avoids conflicts with system Postgres
- **tsx runtime** for NestJS dev — does NOT emit `design:paramtypes`, so every NestJS constructor parameter uses `@Inject(TypeName)` explicitly
- **`next.config.js` rewrites** `/api/*` → `http://localhost:4000/api/v1/*` — single-port frontend dev
- **Theme cookie** for server-side hydration — reads via `cookies()` from `next/headers`, avoids flash of wrong theme
- **`api.ts` unwrap pattern** — `request()` strips the `ResponseInterceptor` wrapper so components get clean `data` objects

### Stack Details
- **Frontend:** Next.js 16, React 19, Tailwind CSS, shadcn/ui patterns, TypeScript
- **Backend:** NestJS 11, TypeScript, tsx runner
- **Database:** PostgreSQL 17, Drizzle ORM, Zod for validation
- **Auth:** JWT (access + refresh tokens), Argon2 password hashing
- **Real-time:** Socket.IO (scaffolded), Redis pub/sub
- **Storage:** Pluggable (local provider implemented, Cloudflare R2 planned)
- **Testing:** Vitest (frontend), Jest (backend), total ~193 tests passing

## Current Progress

### ✅ Complete
- Full auth flow (register, login, verify email, reset password, sessions)
- Workspace CRUD + member management + invitations + roles
- Board CRUD + columns + archive + Kanban frontend
- Task CRUD + status lifecycle + drag-and-drop + priorities + checklists
- Threaded comments on boards
- In-app notifications with 7 domain event handlers
- Dashboard with real stats + activity feed
- User profiles + settings (profile, security, preferences, danger zone)
- Audit logging for workspaces and boards
- Global search
- Theme toggle (light/dark) with hydration-safe cookie persistence

### 🔶 Partially Complete
- **Canvas** — object CRUD backend, surface/renderer/selection frontend, WebSocket sync scaffolded but not E2E tested
- **Realtime** — Socket.IO gateway scaffolded, presence interfaces defined
- **Uploads** — file upload backend + local storage provider, frontend upload button and file sidebar
- **AI** — provider interface + Gemini implementation, frontend dialog + summarize panel scaffolded
- **Notifications push** — notification table + API handlers done, push subscription layer removed (waiting on infrastructure decision)

### ⬜ Not Started
- OAuth/SSO login
- Docker Compose for production
- Cloudflare R2 storage integration
- Live cursor / presence indicators
- Collaborative document editing
- AI search / diagram generation
- Calendar view for tasks
- E2E testing

## Known Issues

1. **Notification handler `onModuleInit()`** — handlers registered 0 times in dev server log. All 7 handlers query `listByWorkspace()` which filters `deletedAt IS NULL`. Only TASK_ASSIGNED delivers in E2E.

2. **`@Public()` + `@CurrentUser()`** conflict on `workspaces.controller.ts:acceptInvitation` — `@Public()` skips auth guard but `@CurrentUser()` returns `undefined`. Needs userId passed via DTO or guard refactor.

3. **Canvas/Realtime/Uploads modules** — backend scaffolded but not integrated into app flow, no E2E coverage.

4. **Most doc files are empty** — `docs/features/*.md`, `docs/database/schema.md`, `docs/api/routes.md`, `docs/architecture/system-overview.md` are all 0-byte stubs.

## What To Do Next (Priority Order)

### Priority 1 — Ship the MVP (fix gaps in built features)
1. **Fix notification handler registration** — ensure `onModuleInit()` actually registers all 7 handlers, fix `listByWorkspace()` query to show notifications for all workspace members
2. **Fix `@Public()` + `@CurrentUser()`** — refactor `acceptInvitation` to accept userId in DTO or use a separate guard
3. **Complete the uploads flow** — wire frontend upload button → API → local storage → board file sidebar display
4. **Integrate canvas** — connect canvas frontend surface to API + WebSocket, verify end-to-end object CRUD + sync
5. **Write E2E tests** for critical paths: auth flow, workspace CRUD, board CRUD, task lifecycle, comment flow

### Priority 2 — Real-Time Collaboration
6. **Live cursors** — broadcast cursor positions via Socket.IO, render remote cursors on canvas
7. **Object locking** — prevent conflicting edits on the same canvas object
8. **Presence indicators** — show who's viewing the same board/workspace
9. **Undo/redo** — command pattern with history stack

### Priority 3 — Deployment & Infrastructure
10. **Docker Compose** — containerize API + web + Postgres + Redis for one-command startup
11. **Cloudflare R2 storage** — implement the R2 storage provider for production file uploads
12. **CI/CD pipeline** — automated build, lint, test, deploy (Cloudflare Workers for API, Pages for frontend)

### Priority 4 — Feature Completeness
13. **OAuth/SSO** — Google, GitHub login providers
14. **AI features** — wire the AI dialog to generate diagrams/boards, AI summarize on boards, AI search
15. **Calendar view** — task due dates on a calendar
16. **Push notifications** — service worker + Web Push API (infrastructure decision needed first)
17. **Fill doc stubs** — write `docs/features/*.md`, `docs/database/schema.md`, `docs/api/routes.md`, `docs/architecture/system-overview.md`

### Priority 5 — Polish & Scale
18. **Performance** — pagination/infinite scroll on all list views, query optimization, bundle analysis
19. **Accessibility** — audit WCAG compliance, keyboard navigation, screen reader support
20. **Multi-region/tenant** — workspace isolation, data partitioning
