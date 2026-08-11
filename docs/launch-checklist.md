# Launch Checklist — Workspace OS

Status: MVP feature-complete (boards, tasks, comments, notifications, realtime canvas + collab), not yet deployable as a public SaaS. This checklist is the gap map between "works locally" and "safe to launch".

> **Decision (2026-08-11): launch/deployment work is PARKED until the project is complete.** The hosting choice (container runtime vs Cloudflare Workers vs hybrid) is not made yet. Do not treat any P0/P1/P2 item below as blocking development. The only habits to keep while building: no committed secrets, no dev-only artifacts in shipped code, tests stay green.

Legend: P0 = blocks public launch · P1 = should-have before public launch · P2 = first 90 days

---

## P0 — Blocks launch

### 1. Production infrastructure (largest gap — deployment is undecided)
- [ ] Pick a deployment target.
  - Cloudflare Workers + Pages is the roadmap lean (`docs/project-progress.md`) — NOTE: the API is NestJS 11, which does not run on Workers without a port; either use a container runtime (Fly.io / Railway / VPS) or plan a Workers rewrite.
  - API + web share the repo; both need prod builds (`pnpm build`), env split, and a deploy pipeline.
- [ ] Managed PostgreSQL 17 (Supabase or Neon). Local is Postgres on :5433; Drizzle migrations must run against prod.
- [ ] Managed Redis (Upstash or similar) — required by the realtime module and JWT/session flows; without it the canvas gateway and presence die.
- [ ] Domain(s) + TLS + DNS. Cookie/localStorage JWT auth means one origin first; use a single app domain for MVP (e.g. `app.example.com`) rather than splitting API subdomain until you know you must.
- [ ] Environment: prod `.env` in a secrets store (never in git). Mirror `apps/api/src/config/env.schema.ts` and `apps/api/src/config/configuration.ts` keys in prod.

### 2. Production file storage
- [ ] Replace the local uploads provider (currently writes to `apps/api/uploads/` — see the committed test file under `a473e5b9-.../` as evidence it's live) with Cloudflare R2 or S3.
- [ ] Set per-user and per-board quotas + file-type allowlist before public traffic (uploaded images are rendered on the canvas — validation is the attack surface).

### 3. Functionality gates (the canvas was live-tested 2026-08-11; these were found and fixed)
- [x] **Text/sticky-note click-create was broken** (objects were auto-deleted on pointerup). Fixed: click now creates a default-sized note, opens the text editor, and selects the object.
- [x] **Toolbar overflowed** (wrapped to 170px tall at 1440px, cutting off shapes/colors/zoom). Fixed: single compact row, internal scroll on narrow screens (verified at 1440 and 390px).
- [x] **Drawn objects weren't auto-selected** → keyboard Delete and the context menu appeared dead. Fixed.
- [x] **Undo flooded per drag-frame** (one drag = dozens of undo steps). Fixed: per-gesture snapshots; verified move/draw undo+redo single-step.
- [x] **Text edit box opened at screen center** regardless of object position. Fixed: positioned at the object; Esc now cancels instead of committing.
- [x] **Dev focus thief**: the impeccable live-steer script injected into `apps/web/app/layout.tsx` autofocused an input on every page load (swallowing canvas keyboard shortcuts) and would have shipped. Script tag removed; re-inject only while actively steering.
- [x] Zoom-to-cursor (Ctrl+scroll and toolbar −/+/reset), zoom-aware hit tests, tool shortcuts (V/R/O/L/A/T/N/C), empty-state hint, grab cursor while space-panning, system color palette (purple/candy swatches removed), canvas render loop perf (theme colors cached, canvas resized only on change).
- [ ] Sweep `docs/project-progress.md` → Known Issues for anything not already verified E2E.

### 4. Security hardening before public traffic
- [ ] Rate limiting: login, register, password reset, invitations, AI endpoints, uploads (API is NestJS — `@nest-lab/throttler` or gateway-level limits).
- [ ] Enforce email verification (currently optional) OR accept that accounts are disposable; decide before invite links go public (invite tokens `selector`/`verifier` are already verified E2E).
- [ ] Audit log: exists — verify it covers auth failures and destructive actions in prod.
- [ ] Review JWT settings: access TTL is 900s; refresh-token rotation + revocation on password change. Secrets must move to a real store.
- [ ] CORS + origin allowlist on the API, Socket.IO `transport`/origin checks, and canvas payload size limits (image data URLs are stored in the DB via `data`).

### 5. Observability
- [ ] Error tracking on web + API + Socket.IO gateway (Sentry).
- [ ] Structured prod logging (today's logs are dev-style). Include websocket connect/disconnect + object-lock events for the realtime path.
- [ ] Uptime monitoring + alerting (UptimeRobot / Betterstack).
- [ ] Product analytics (PostHog or Plausible) — activation events: first board, first canvas object, invite sent.

## P1 — Should have before public launch

- [ ] **Load test the realtime gateway** — presence/websockets is the defining feature. Target 100–500 concurrent sockets with object create/update and cursor moves (`apps/api/src/modules/realtime/gateways/canvas.gateway.ts`). No load tests exist yet.
- [ ] E2E test suite for: auth → workspace → board → task → comments → notifications → canvas → 2-user collab (presence, cursors, locks). None exists today; Playwright is the pragmatic choice.
- [ ] OAuth/SSO (Google, GitHub) — roadmap P4#13; most SaaS users expect it.
- [ ] Legal: Terms of Service, Privacy Policy, cookie consent (EU); GDPR/CCPA basics. AI features (Gemini) add a data-processing disclosure.
- [ ] Empty/error/offline states: canvas load failure currently resolves to a silent empty canvas (`canvas-sync.tsx` swallows the load error) — surface it. Document offline/backoff for sockets.
- [ ] CI/CD (roadmap P4#12): build + lint + test + migrate + deploy on every push; at minimum a `pnpm lint && pnpm test && pnpm build` gate.
- [ ] Backups: prod DB daily snapshots + restore drill + retention policy; R2 lifecycle rules for uploads.

## P2 — First 90 days after launch

- [ ] Documentation: fill the 0-byte stubs — `docs/features/*.md`, `docs/database/schema.md`, `docs/api/routes.md`, `docs/architecture/system-overview.md`.
- [ ] Performance pass (roadmap P5#18): pagination on boards/tasks/comments, bundle analysis, canvas object count limits (very large canvases currently re-render full lists per frame).
- [ ] Onboarding: first-run empty states (dashboard, board, canvas — canvas one exists now); a sample/template board would materially help activation.
- [ ] Support channel + in-app feedback loop; capture it per workspace.
- [ ] Landing page + public docs site.
- [ ] Explicit non-goals stay out of MVP: billing/plans, plugin marketplace, enterprise SAML.

## Suggested order

1. Finish any remaining Known Issues sweep (0.5–1 day)
2. R2 storage + managed Postgres/Redis + env split + CI gating (2–3 days)
3. Rate limiting + email verification + payload validation (1 day)
4. Sentry + structured logging + uptime (0.5 day)
5. Socket load test (100–500 conns) + fix findings (1 day)
6. Landing page + 5–10 hand-picked alpha teams → iterate on real usage → public launch

## Context

- Repo: monorepo — `apps/web` (Next.js 16), `apps/api` (NestJS 11), `packages/database` (Drizzle), Redis, Socket.IO.
- Local: API :4000, web :3000, Postgres :5433, Redis :6379. `pnpm dev` from repo root.
- Verifications done 2026-08-11: canvas interaction suite (desktop 1440 + mobile 390), undo/redo single-step, focus-thief removal, detector clean on all edited canvas components.