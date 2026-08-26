# Workspace OS — Audit & Rebuild Plan

**Date:** 2026-08-22
**Stack:** Next.js frontend, NestJS API, PostgreSQL (Drizzle ORM), Socket.IO
**Goal:** Transform functional MVP into fundable SaaS

---

## Phase 0 — Audit (No Code Changes)

Full written audit covering:
- Codebase map (folder structure, routing, state management, API layer, DB schema)
- Design audit (every screen/state, AI-generated tells, spacing, typography, color)
- Backend audit (auth, validation, error handling, indexes, N+1, rate limiting, logging, tests)
- Gap list (Missing / Partial / Present for every SaaS requirement)

## Phase 1 — Design System & UI/UX Overhaul

- Typography: deliberate type pairing, modular scale (12/14/16/20/24/32/48)
- Color: full semantic palette for dark + light modes, 2-3 accent hues
- Spacing & density: consistent spacing scale, one density mode
- Elevation: 2-3 shadow levels max
- Iconography: single icon set (Lucide), no emoji-as-icons
- Empty states: designed illustrations + CTA for every list/board/canvas
- Loading states: skeleton loaders matching content shape
- Error states: inline, actionable error messaging
- Micro-interactions: hover, focus rings, transitions (150-200ms)
- Navigation: sidebar/topbar audit, breadcrumbs, workspace switching
- Responsive: real mobile layouts for core flows
- Accessibility: keyboard nav, ARIA, WCAG AA contrast, focus management

**Output:** Design token set (CSS vars / Tailwind config) applied across every screen.

## Phase 2 — Backend Hardening

- Validation: zod/joi on every API route
- Auth: argon2, JWT refresh rotation, rate-limited login/reset, email verification
- Authorization: RBAC per resource (Owner/Admin/Member/Guest)
- Error handling: centralized middleware, consistent error shape, no stack traces
- Database: missing indexes, transactions, migration tooling
- Rate limiting & abuse prevention
- Logging: structured (pino), request IDs, Sentry hook points
- API design: consistent REST conventions
- Testing: integration tests for auth + core resources

## Phase 3 — Missing SaaS Functionality

- [ ] Multi-tenancy / Organizations
- [ ] Roles & permissions (RBAC) enforced server-side
- [ ] Invitations with expiry and role assignment
- [ ] Billing & subscriptions (Stripe)
- [ ] Onboarding first-run experience
- [ ] Email notifications (Resend/Postmark/SES)
- [ ] Settings (workspace + personal)
- [ ] Admin/back-office view
- [ ] Audit log
- [ ] Real search across tasks/boards
- [ ] Real-time collaboration with conflict resolution

## Phase 4 — Production Readiness

- [ ] Environment config (dev/staging/prod separation)
- [ ] CI/CD (lint + typecheck + test on PR)
- [ ] Monitoring (Sentry, uptime, performance)
- [ ] Marketing landing page
- [ ] Legal pages (ToS, Privacy Policy)
- [ ] Performance audit (bundle size, images, query perf)

---

## Phase Output Format

Each phase outputs:
1. What changed (file-level summary)
2. Why (what problem it fixes)
3. What was deliberately NOT done and why
4. What I need from you to continue
