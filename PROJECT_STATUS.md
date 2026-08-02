# Project Status

**Date**: 2026-08-02
**Branch**: main
**Latest Commit**: `bd29b83` — "feat(ui): design system, live polish pass, canvas bugfixes"

---

## 1. What I Used to Build It

The project is a **pnpm monorepo** managed with **Turborepo**, split into two applications and four shared packages:

- **Frontend** — `apps/web`: **Next.js 16** (App Router) with **React 19**, styled with **Tailwind CSS 4**, **lucide-react** icons, **@dnd-kit** for drag-and-drop, and custom fonts (Geist + Space Grotesk).
- **Backend** — `apps/api`: **NestJS 11** — 15 feature modules, REST + WebSocket endpoints, documented with **Swagger**, secured with **Helmet**, and validated with **Zod**.
- **Database** — `packages/database`: **PostgreSQL** accessed through the **Drizzle ORM**, with typed schema, enums, and migrations — shared by all packages.
- **Shared** — `packages/ui` (reusable components), plus shared ESLint and TypeScript configurations.

Passwords are hashed with **argon2**; authentication uses **JWT access tokens with refresh-token rotation** stored in the database.

## 2. How the Codebase Works

The flow is a classic three-tier architecture. The browser talks to Next.js, which calls the NestJS REST API over `/api/v1` with a bearer token. The API validates the request through guards, runs the business logic in services, and persists data in PostgreSQL via Drizzle repositories. Domain events fire on key actions (task created, member added, board archived), and a notification handler turns those events into user notifications and audit-log entries.

## 3. The Backend

The API currently has 15 modules. Let me walk through what's complete:

- **auth** — registration, email verification, login, password reset, refresh-token rotation
- **users** — profiles and administration
- **workspaces** — teams, invitations, members (with user details joined in)
- **boards & tasks** — kanban boards, task cards, checklists
- **comments** — threaded activity on tasks
- **notifications** — event-driven inbox (9 handler tests)
- **audit & search** — an activity feed and a search service
- **canvas** — a full drawing-app backend: shape objects, layers, undo/redo history, persistence
- **uploads, realtime, ai** — file uploads, WebSocket presence, and AI services are scaffolded but not yet fully integrated

## 4. The Frontend

The frontend is organized by route groups: authentication screens, a dashboard with recent-boards and skeleton loading, notifications, settings, a user directory, and the workspace area — board lists, kanban boards, and the canvas page.

Every UI detail follows a written design system in `DESIGN.md` — a "quiet-reactive" visual language: calm blue accents used sparingly, compact work text, and both dark and light themes.

The kanban board supports full drag-and-drop with @dnd-kit. The canvas supports panning, zooming with Ctrl+scroll, drawing tools, layers, undo/redo, a context menu with paste, and keyboard shortcuts — with an image-decode cache and theme-aware rendering.

## 5. Quality

The backend has **29 test suites — 198 tests passing** covering services, controllers, and notification handlers. The frontend passes TypeScript strict checking and ESLint with zero warnings allowed. Every change is verified before it's committed.

I should also mention the development process itself: much of the implementation was done with an **AI coding agent** — I direct it through design review sessions, live visual feedback loops against the running app, and iterative polish rounds, reviewing and accepting each change myself.

## 6. What's Left to Be Done

- **Real-time collaboration** — the WebSocket gateway exists; I want live multi-user presence and shared canvas cursors
- **File uploads** — the backend scaffold is ready; wiring the UI is next
- **AI features** — the module is scaffolded; planning smart suggestions
- **Production hardening** — role-based access control on admin routes (the user directory currently isn't gated), deployment to a static IP with HTTPS, and containerized Docker infrastructure
- **OAuth/SSO login** as an optional auth path

## 7. Closing

To summarize: a full authentication system, team workspaces, kanban boards, notifications, audit tracking, and a canvas editor — all with a polished, documented design system and a tested backend. The foundation is solid; the remaining work is integration, real-time polish, and deployment. Thank you — I'm happy to take questions.
