# User Directory Peer-Scoping — Design Spec

**Date:** 2026-08-19
**Status:** Approved by user (Approach A)

## Problem

The API is publicly deployed (Render) with public registration. Any registered user can
enumerate the entire user base and read other users' private data:

- `GET /api/v1/users` — list all users (names, emails) with search
- `GET /api/v1/users/:id` — full profile (including email) of any user
- `GET /api/v1/users/:id/memberships` — any user's workspace memberships
- `GET /api/v1/users/:id/activity` — any user's audit activity

Workspace member mutations are already role-gated (`requireRole(OWNER)`); the gap is the
global user directory and profile endpoints.

## Design

### 1. Peer-scoping rule (UsersService)

A user's **peers** = distinct users sharing ≥1 workspace with the requester, where **both**
memberships have status `ACTIVE` (PENDING invitees are excluded).

- New helper `getPeerIds(requesterId): Promise<string[]>` — implemented as a single query
  over `workspace_memberships` (distinct user ids joined through shared active workspaces).
- `listUsers(...)` — filter results to peers ∪ self before returning. Pagination and search
  still apply within that set.
- `getUserById(id, requesterId)` — return profile if `id === requesterId` or peer, otherwise
  throw the existing user-not-found error (**404**, never 403 — do not leak existence).
- `getUserMemberships(id, requesterId)` / `getUserActivity(id, requesterId)` — same rule,
  else 404.
- `getMe` / `updateMe` — unchanged (always the requester themselves).

### 2. Workspace members endpoints (verify, not assume)

- `GET /workspaces/:id/members` — confirm the service rejects non-members; add an explicit
  membership check if missing.
- `PATCH /workspaces/:id/members/:userId/role` and `DELETE .../members/:userId` — keep
  existing OWNER gate (already enforced via `requireRole`).

### 3. Error handling

Non-peer lookups return 404 (`UserNotFoundError`, existing error code) — indistinguishable
from a user who does not exist. No 403 responses added.

### 4. Web app

No changes required. The `/users` directory page and `/users/:id` profile pages keep working;
they simply show colleagues only. Invites are raw email-based and unaffected.

## Testing (API jest suites)

- Peers can fetch each other's profile / memberships / activity.
- Non-peers get 404 on all three user endpoints.
- `listUsers` excludes non-peers, with and without a search term; includes self.
- PENDING memberships do not create peer visibility.
- Non-member cannot list a workspace's members.
- Run `pnpm --filter api test` (expect 29 suites + new cases, all green).

## Out of scope

- Changing the directory page UI or pagination contract.
- Restricting authenticated `GET /users/me` or profile editing.
- Rate limiting or abuse protection (separate concern).

## Bonus fix (approved separately)

`borderGlow` keyframe in `apps/web/app/globals.css` still uses the pre-rebrand blue
`rgb(59 130 246/…)` → replace with lavender `rgb(214 207 225/…)` (primary-400), preserving
the existing keyframe structure.