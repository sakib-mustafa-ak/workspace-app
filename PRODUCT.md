# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing monorepo: Next.js 16 (apps/web), NestJS 11 (apps/api), PostgreSQL 17 + Drizzle ORM (packages/database), Redis, Socket.IO, TurboRepo + pnpm. Tailwind CSS with a custom dark-first design system (surface-950 backgrounds, primary-600 accents, glassy cards). Both product name ("Workspace OS") and the visual language are explicitly NOT binding — open to change.

## Users

General-purpose teams (software teams, startups, universities, students, product teams, designers, researchers, project managers, open-source communities). Primary situation: a team needs to brainstorm, plan, and run work in one shared space rather than juggling separate tools.

## Product Purpose

A collaborative workspace platform that combines whiteboard, task management, documentation, and communication into one modular ecosystem — the "operating system" where teams perform their daily work. Success for the MVP means real-time visual collaboration: multiple people working on a shared canvas/whiteboard with live presence and synchronization.

## Positioning

Not "another whiteboard" — a workspace OS: every capability (whiteboard, tasks, docs, chat, AI) is a modular, replaceable feature in one platform. The meaningfully different mechanism is unifying visual collaboration and structured work (boards/tasks) in real time within the same workspace.

## Operating Context

- Teams sign up (email + password, optional email verification), create workspaces, invite members by email link, and grant roles (Owner / Admin / Editor / Member).
- Work flows through workspaces → boards (Kanban columns) → tasks (assignee, due date, priority, checklist) with comments and in-app notifications on every domain event.
- A canvas (infinite whiteboard with shapes, text, sticky notes, images, connectors, layers) is under active development with Socket.IO sync.
- Settings (profile, security, preferences, danger zone), user directory, global search, audit log, and AI assistance (Gemini provider interface) are part of the platform surface.
- Evaluated from a browser; dev runs web on :3001 and API on :4000 via `pnpm dev`.

## Capabilities and Constraints

Confirmed capabilities:
- Auth: register, login, JWT access/refresh tokens, email verification, password reset, sessions.
- Workspaces: CRUD, members, invitations (selector/verifier token links), role-based access, transfer ownership.
- Boards: CRUD, columns, archive/unarchive, templates, import/export; Kanban view with drag-and-drop.
- Tasks: CRUD, status lifecycle (Todo → In Progress → Done), priority, assignee, due dates, checklists.
- Comments: threaded on boards; notifications: in-app lifecycle (Created → Queued → Delivered → Read → Archived) driven by domain event buses.
- Users: profiles, admin listing/deletion; audit log; global search; theme toggle (light/dark).
- Scaffolded/partial: canvas objects + realtime gateway (not E2E-verified), file uploads (local storage provider), AI (Gemini + mock providers), push notifications (backend removed; service worker + hook remain).

Constraints:
- API responses are uniformly wrapped `{ success, data, message }`; frontend API client unwraps them.
- NestJS runs on tsx (no `design:paramtypes`), so DI must be explicit with `@Inject`.
- Postgres on port 5433 locally; Redis required for the realtime module.

Undecided:
- Product name may change; visual design language is open to rework.
- Deployment target (Cloudflare Workers/Pages vs other) not chosen.
- Billing, plugin marketplace, enterprise SAML are explicitly non-goals for the MVP.

## Brand Commitments

None binding. The incumbent name and dark-first visual world are treated as evidence, not commitments; both are open to change.

## Evidence on Hand

- `docs/ProjectBlueprint.md` — engineering handbook, vision, domain design, roadmap (single source of truth for architecture).
- `README.md` — planned feature set, roadmap phases 1–10.
- `docs/project-progress.md` — build status, known issues, prioritized next steps.
- `PROJECT_STATUS.md` — module/route status snapshot.
- `docs/superpowers/` — per-phase implementation plans and design specs.
- Absences: no testimonials, customers, benchmarks, pricing, or deployment claims exist; future work must not fabricate them.

## Product Principles

- Everything is collaborative — presence and real-time sync are the default, not an add-on.
- Modular and extensible — every feature is an independent module; every major capability can be replaced without rewriting business logic.
- Unified, not fragmented — teams should not hop between tools; one workspace hosts visual + structured work.
- Production-grade foundations — clean architecture, event-driven design, reusable packages over speed.
- Real-time visual collaboration is the MVP's defining job; fundamentals (auth, workspaces, boards, tasks) must be solid enough to support it.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established yet. (Web platform — WCAG conformance is an open decision, not a confirmed commitment.)
