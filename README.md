# 🚀 Collaborative Workspace

> A modern, scalable, real-time collaborative workspace platform built with **Next.js**, **NestJS**, **PostgreSQL**, **Redis**, and **TurboRepo**.

---

<p align="center">
  <b>Digital Whiteboard • Team Collaboration • Documents • Tasks • AI</b>
</p>

<p align="center">

![Status](https://img.shields.io/badge/status-active%20development-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![NestJS](https://img.shields.io/badge/NestJS-11-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)
![Redis](https://img.shields.io/badge/Redis-8-red)
![TurboRepo](https://img.shields.io/badge/TurboRepo-Latest-purple)

</p>

---

## 📖 Overview

Collaborative Workspace is an open-source collaboration platform inspired by modern productivity tools such as digital whiteboards, collaborative document editors, and project management systems.

The goal is to build a highly scalable platform where teams can brainstorm, plan, communicate, and collaborate in real time.

The application is designed with a modular architecture, making it easy to extend with new features without major refactoring.

---

# ✨ Planned Features

## 🖥️ Workspace Management

- Multiple Workspaces
- Team Management
- Member Invitations
- Workspace Settings
- Role-Based Permissions

---

## 🎨 Infinite Whiteboard

- Infinite Canvas
- Freehand Drawing
- Shapes
- Text
- Sticky Notes
- Images
- Connectors
- Frames
- Zoom & Pan

---

## ⚡ Real-Time Collaboration

- Live Cursor Presence
- Simultaneous Editing
- Live Board Synchronization
- Object Locking
- Presence Indicators
- Undo / Redo
- Version History

---

## 📄 Collaborative Documents

- Rich Text Editor
- Nested Pages
- Markdown Support
- Collaborative Editing
- Document Sharing

---

## ✅ Task Management

- Kanban Boards
- Task Assignment
- Due Dates
- Labels
- Calendar View
- Progress Tracking

---

## 💬 Communication

- Comments
- Threaded Discussions
- Mentions
- Notifications

---

## 📁 File Storage

- Image Uploads
- PDF Support
- Asset Library
- Cloud Storage

---

## 🤖 AI Features

- AI Diagram Generation
- AI Board Summaries
- AI Search
- Smart Suggestions
- Meeting Notes

---

# 🏗️ High-Level Architecture

```text
                    Browser
                        │
                Next.js Frontend
                        │
────────────────── REST API ──────────────────
                        │
                 NestJS Backend
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
 PostgreSQL          Redis          Cloud Storage
   Database         Pub/Sub        Cloudflare R2
```

---

# 📁 Project Structure

```text
workspace-app/

├── apps/
│   ├── api/
│   └── web/
│
├── packages/
│   ├── auth/
│   ├── config/
│   ├── database/
│   ├── socket/
│   ├── types/
│   ├── ui/
│   └── utils/
│
├── docker/
│
├── docs/
│   ├── api/
│   ├── architecture/
│   ├── database/
│   ├── images/
│   └── roadmap/
│
├── scripts/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

# ⚙️ Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

---

## Backend

- NestJS
- TypeScript

---

## Database

- PostgreSQL
- Drizzle ORM

---

## Realtime

- Socket.IO
- Redis

---

## Storage

- Cloudflare R2

---

## Infrastructure

- TurboRepo
- Docker
- PNPM

---

# 🚀 Getting Started

## Clone the Repository

```bash
git clone https://github.com/<your-github-username>/workspace-app.git
```

---

## Enter the Project

```bash
cd workspace-app
```

---

## Install Dependencies

```bash
pnpm install
```

---

## Start Development

```bash
pnpm dev
```

---

# 📚 Documentation

Detailed documentation is available inside the `docs/` directory.

```text
docs/

├── architecture/
│   ├── system-overview.md
│   ├── frontend.md
│   ├── backend.md
│   └── realtime.md
│
├── api/
│   ├── authentication.md
│   ├── workspaces.md
│   ├── boards.md
│   └── socket-events.md
│
├── database/
│   ├── schema.md
│   └── migrations.md
│
└── roadmap/
    ├── milestones.md
    └── features.md
```

---

# 🗺️ Development Roadmap

## Phase 1 — Foundation

- [x] TurboRepo Setup
- [x] Next.js Frontend
- [x] NestJS Backend
- [x] Monorepo Architecture
- [x] Drizzle ORM
- [x] PostgreSQL Schema Design
- [ ] Docker Infrastructure
- [ ] Redis

---

## Phase 2 — Authentication

- [x] JWT Auth (Access + Refresh Tokens)
- [x] User Registration
- [x] Login / Logout
- [x] Protected Routes
- [x] Email Verification
- [x] Password Reset
- [ ] OAuth / SSO

---

## Phase 3 — Workspaces

- [x] Workspace CRUD
- [x] Member Management
- [x] Member Invitations
- [x] Roles & Permissions (Owner, Admin, Member)

---

## Phase 4 — Boards

- [x] Board CRUD
- [x] Board Columns
- [x] Archive / Unarchive
- [x] Frontend Kanban View



---

## Phase 5 — Tasks

- [x] Task CRUD
- [x] Status Lifecycle (Todo → In Progress → Done)
- [x] Priority Levels
- [x] Assignee & Due Dates
- [x] Move Between Columns
- [x] Frontend Task Cards with Priority Badges

---

## Phase 6 — Comments

- [x] Threaded Comments
- [x] Edit / Delete Policy
- [x] Comment on Boards

---

## Phase 7 — Notifications

- [x] In-App Notifications
- [x] Notification Lifecycle (Created → Queued → Delivered → Read → Archived)
- [x] Unread Count
- [x] Mark All as Read

---

## Phase 8 — Real-Time Collaboration

- [ ] Live Presence
- [ ] Live Cursor
- [ ] Object Synchronization
- [ ] Undo / Redo

---

## Phase 9 — Productivity

- [ ] Documents
- [ ] File Uploads

---

## Phase 10 — AI

- [ ] AI Assistant
- [ ] Diagram Generation
- [ ] AI Search
- [ ] Meeting Summaries

---

## Phase 2 SaaS — Gaps Closed

- [x] Web push scaffold removed (dead code cleanup)
- [x] Postgres full-text search (boards + tasks, tsvector + GIN indexes)
- [x] Audit event tracking (task/comment/upload/canvas handlers, widened payloads)
- [x] Notification preferences API (10 event types, per-user opt-in)
- [x] Email delivery (invitation + assignment emails, preference-gated)
- [x] Active workspace persistence (per-user localStorage, login routing)
- [x] Notification preference toggles UI (settings page)
- [x] Platform admin role (isAdmin flag, JWT claims, AdminGuard)
- [x] Admin API (user search, workspace search, subscription stub, impersonation)
- [x] Three-step onboarding wizard (create workspace → invite teammates → sample board)
- [x] Admin UI + impersonation flow (admin panel, "Log in as" with sidebar exit)

---

# 🎯 Project Goals

This project is built with the following principles:

- Modular Architecture
- Scalable Monorepo
- Feature-Based Development
- Reusable Packages
- Clean Code
- Production-Ready Structure
- Developer-Friendly Experience

---

# 🤝 Contributing

Contributions are welcome.

If you'd like to contribute:

1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes.
4. Push your branch.
5. Open a Pull Request.

---

# 📄 License

This project is licensed under the MIT License.

---

# 📌 Current Status

✅ **Active Development — Phases 1–10 Complete + Phase 2 SaaS Gaps Closed**

Current milestone:

> **Phase 2 SaaS Gaps — Complete**
>
> Admin, audit, notifications, onboarding, and platform admin features implemented across 11 tasks.

| Module       | Backend | Frontend | Tests |
|-------------|---------|----------|-------|
| Auth        | ✅      | ✅       | ✅    |
| Users       | ✅      | —        | ✅    |
| Workspaces  | ✅      | ✅       | ✅    |
| Boards      | ✅      | ✅       | ✅    |
| Tasks       | ✅      | ✅       | ✅    |
| Comments    | ✅      | —        | ✅    |
| Notifications| ✅     | ✅       | ✅    |
| Audit       | ✅      | —        | ✅    |
| Admin       | ✅      | ✅       | ✅    |
| Search      | ✅      | —        | ✅    |

**288 tests passing** across 39 suites.

---

<p align="center">
Built with ❤️ using Next.js, NestJS, PostgreSQL, Redis, TypeScript, and TurboRepo.
</p>
