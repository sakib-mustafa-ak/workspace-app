# Phase 3 — Stripe Billing & Usage Limits — Design

Date: 2026-08-30
Status: Approved (pending written-spec review)

## 1. Overview

Add workspace-scoped subscription billing with Stripe (Checkout, Billing Portal, webhooks), server-enforced usage limits per plan tier, plan visibility in the workspace settings UI, and real subscription data wired into the admin back-office. Three tiers: **Free**, **Pro** (per-seat), **Team** (per-seat premium + audit-log export).

Prices are placeholders. Every price-like number in this phase is marked `TODO: confirm pricing`. No final-looking numbers are invented anywhere.

## 2. Locked decisions

1. **Billing scope: workspace.** Confirmed against the model — `workspaces.ownerId` is the billing contact; seats come from `workspace_members`; workspaces are the tenant unit for every existing module. Team product, workspace-level billing.
2. **Free = 1 owned workspace.** The cap applies to workspaces a user *owns*; memberships in others' workspaces are unlimited. Enforced at workspace creation and at ownership transfer-in.
3. **Seat = ACTIVE member only.** Pending invitations and suspended members do not consume a seat. This is intentionally distinct from the existing `memberCount` stats value (which counts PENDING + SUSPENDED).
4. **Block new, keep existing.** Mutations that would exceed a limit are refused with a structured error; existing over-limit rows are never deleted or forced to shrink. Downgrades may leave a workspace over-limit; that is accepted state, surfaced in the UI.
5. **Team's differentiator is real this phase:** the `audit_log_export` feature gates a workspace audit-log export endpoint. SSO and admin-tools remain placeholder flags (`FEATURE.SSO`, `FEATURE.ADMIN_TOOLS`) with no gating yet.
6. **Admin back-office stays `isAdmin`-gated** (platform user property). The Team "admin access" perk is not wired to the back-office page.

## 3. Data model (`packages/database`)

New `schema/billing/` folder with its own `index.ts`, re-exported from `schema/index.ts`. Migration generated via `pnpm --filter @repo/database generate` (drizzle-kit), consistent with the existing `<idx>_<codename>.sql` + journal/snapshot convention.

### `workspace_subscriptions` — one row per workspace

| column | type | notes |
|---|---|---|
| `id` | `PRIMARY_ID()` (UUIDv7) | |
| `workspaceId` | uuid | UNIQUE, FK → `workspaces.id`, ON DELETE CASCADE |
| `plan` | pgEnum `FREE/ PRO/ TEAM` | default `FREE` |
| `stripeStatus` | text, nullable | raw Stripe subscription status |
| `stripeCustomerId` | text, nullable | |
| `stripeSubscriptionId` | text, nullable | partial UNIQUE where not null |
| `currentPeriodEnd` | timestamptz, nullable | |
| `upgradedAt` | timestamptz, nullable | |
| `createdAt` / `updatedAt` | timestamptz | |

Row created at workspace creation (defaults to FREE) — single source of truth, no "no row means free" special-casing.

### `stripe_webhook_events` — idempotency log

| column | type |
|---|---|
| `id` | `PRIMARY_ID()` |
| `eventId` | text, UNIQUE |
| `type` | text |
| `workspaceId` | uuid, nullable (event may not reference a workspace) |
| `processedAt` | timestamptz |

The unique `eventId` is the idempotency key.

## 4. Billing module (`apps/api/src/modules/billing/`)

```
billing.module.ts
errors/billing.errors.ts
plans.ts
billing.constants.ts
controllers/billing.controller.ts
data/billing.repository.ts
data/webhook-events.repository.ts
services/stripe.service.ts
services/usage.service.ts
```

### Errors (`errors/billing.errors.ts`)

`BillingException extends BusinessException` with codes:

| code | status | meaning |
|---|---|---|
| `BILLING.NOT_CONFIGURED` | 503 | Stripe keys missing (module booted without them) |
| `BILLING.LIMIT_REACHED` | 422 | a usage limit is hit; carries `details` |
| `BILLING.FEATURE_REQUIRED` | 422 | plan lacks a required feature; carries `details` |
| `BILLING.NO_CUSTOMER` | 409 | no Stripe customer yet (portal requested before checkout) |
| `BILLING.PLAN_NOT_FOUND` | 400 | unknown plan in request |
| `BILLING.WEBHOOK_INVALID` | 400 | signature/event validation failed |

**`details` field**: `BusinessException` gains an optional `details` and `BusinessExceptionFilter` forwards it as `error.details`. Contract for `LIMIT_REACHED`: `{ feature: 'boards' | 'members' | 'ownedWorkspaces', current, limit, plan }`; for `FEATURE_REQUIRED`: `{ feature, plan }`. The frontend renders these (e.g. "3 of 3 boards — upgrade to add more").

### Engine (`services/usage.service.ts`)

- `getPlan(workspaceId): PlanDefinition`
- `getUsage(workspaceId): { plan, status, currentPeriodEnd, features, usage: { boards:{used,limit}, members:{used,limit}, ownedWorkspaces:{used,limit} } }`
- `assertCanCreateBoard(wsId)` — count boards (`boardCount` via existing repos) vs plan.boards
- `assertCanAddMember(wsId)` — count ACTIVE members vs plan.members
- `assertCanOwnWorkspace(userId)` — count owned workspaces vs plan.ownedWorkspaces
- `assertFeature(wsId, feature)` — Team-only `audit_log_export` this phase

Two small repo additions: `countActiveByWorkspace` on the workspace-members repository (current `countByWorkspaces` ignores status) and an owned-workspaces count on the workspaces repository.

### Plans (`plans.ts` + `billing.constants.ts`)

`PlanDefinition` shape:

```ts
type PlanDefinition = {
  id: 'FREE' | 'PRO' | 'TEAM';
  boards: number | null;        // null = unlimited (INTENTIONAL — see §10)
  members: number | null;
  ownedWorkspaces: number | null;
  features: Feature[];
};
```

- FREE: boards 3, members 3, ownedWorkspaces 1, features `[]`
- PRO: unlimited, features `[]`
- TEAM: unlimited, features `[FEATURE.AUDIT_LOG_EXPORT, FEATURE.SSO, FEATURE.ADMIN_TOOLS]`

Feature flags `FEATURE.AUDIT_LOG_EXPORT`, `FEATURE.SSO`, `FEATURE.ADMIN_TOOLS`. Only `AUDIT_LOG_EXPORT` is enforced this phase (§6, §7); the other two exist as flags only (SSO is a placeholder for when OAuth is built). Prices:

```ts
PLACEHOLDER_PRICES = {
  pro:  { monthly: 0 /* TODO: confirm pricing */ },
  team: { monthly: 0 /* TODO: confirm pricing */ },
};
```

Stripe price IDs come from env (`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_TEAM_MONTHLY`).

### Stripe service (`services/stripe.service.ts`)

Lazy SDK construction. Any call with keys absent throws `BILLING.NOT_CONFIGURED`. Methods:
- `createCheckoutSession({ workspaceId, plan, successUrl, cancelUrl, quantity })`
- `createPortalSession(customerId, returnUrl)`
- `constructWebhookEvent(rawBody, signature)` — uses `stripe.webhooks.constructEvent` (SDK helper, never hand-rolled)

## 5. Stripe integration — endpoints

Routes under the existing global prefix/version → `/api/v1/billing/*`.

### `POST /billing/checkout`
Body `{ plan: 'PRO'|'TEAM' }`. Membership role ≥ ADMIN. Creates a Checkout session:
- mode `subscription`, line item price = env price ID for the plan
- `quantity` = current ACTIVE seat count (capped at ≥ 1)
- `metadata { workspaceId, plan }`
- `success_url` / `cancel_url` = `${APP_PUBLIC_BASE_URL}/workspaces/{workspaceId}?billing=success|canceled`
- Returns `{ url }`.

### `POST /billing/portal`
Membership role ≥ ADMIN. Requires `stripeCustomerId` (else `BILLING.NO_CUSTOMER`). Creates a Billing Portal session (self-serve upgrade/downgrade/cancel on Stripe-hosted UI — no custom billing-management UI built). Returns `{ url }`.

### `POST /billing/webhook`
No auth header — signature verification is the auth. Requires (1) raw body capture and (2) `STRIPE_WEBHOOK_SECRET`. Raw body: enable the Nest/Express raw-body capture that `useBodyParser('json', ...)` supports; the webhook route must read the exact bytes. If webhook secret is absent → `BILLING.NOT_CONFIGURED` (503).

Handlers:
- `checkout.session.completed` — expand `session.subscription`; upsert `workspace_subscriptions` from `metadata.workspaceId` + `metadata.plan`; set customer, subscription id, status, period end. Then emit `billing.subscription_changed` audit via the existing `AuditService`.
- `customer.subscription.updated` — find by `stripeSubscriptionId`; sync status/period/plan (plan derived from price if in the env price map; if status `canceled`, plan → FREE).
- `customer.subscription.deleted` — status `canceled`, plan FREE, clear period end.

**Idempotency flow** (per event):
1. verify signature → bad ⇒ 400 `WEBHOOK_INVALID`
2. `claim(eventId)`: INSERT with unique constraint, ON CONFLICT DO NOTHING; if not inserted ⇒ already processed ⇒ return 2xx immediately
3. process handler inside try/catch; on failure ⇒ `release(eventId)` (DELETE the claim) ⇒ return 5xx so Stripe retries
4. success ⇒ keep the claim

Returns a plain 2xx `{ received: true }` (Stripe does not parse the body, so the global `{success,data}` wrapper is harmless — no interceptor change).

## 6. Enforcement points

| Mutation | Guard |
|---|---|
| `boards.service.create` | `assertCanCreateBoard` (after role check) |
| `workspaces.service.create` | `assertCanOwnWorkspace` |
| `workspaces.service.transferOwnership` | `assertCanOwnWorkspace` against the new owner |
| `workspaces.service.createInvitation` / direct member add | `assertCanAddMember` (against ACTIVE count) |

Pending invites do not consume a seat (locked decision #3), so the accept path needs no re-check. Nothing that reduces usage (deletions, removals, transfers out) is ever blocked.

## 7. Team differentiator — audit-log export

Real gating this phase so Team is more than a label:

- New endpoint `GET /api/v1/workspaces/:workspaceId/audit/export?format=json|csv` (audit module).
- Guard: membership ≥ ADMIN **and** `assertFeature(workspaceId, FEATURE.AUDIT_LOG_EXPORT)`.
- Data: reuses `AuditService.listByWorkspace` (bounded, newest first).
- Non-Team or feature not owned ⇒ `BILLING.FEATURE_REQUIRED` 422 with `details { feature, plan }`.

## 8. Config / env

- `envSchema` (Zod, already the pattern): add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_TEAM_MONTHLY` — all optional, no coupling. The S3 `superRefine` "optional unless" style is available if we later want "webhook secret required when secret key set," but for this phase boot must succeed with zero keys present.
- `configuration.ts`: add `billing: { secretKey, webhookSecret, priceIds: { proMonthly, teamMonthly } }`.
- `.env.example`: document all four, price values as placeholders.

## 9. Web

### `apps/web/lib/billing.ts`
`getSubscription(wsId)`, `createCheckout(plan)`, `createPortal()`, `exportAudit(wsId, format)`.

### Workspace settings (`settings-tab.tsx`)
New "Plan & billing" card:
- plan + status badge, `currentPeriodEnd` when present
- usage rows "2 of 3 boards", "3 of 3 members", "1 of 1 workspace"
- **Upgrade** button (PRO/TEAM) → `createCheckout` → redirect to Stripe
- **Manage billing** button → `createPortal` → open URL (only when a customer exists)
- billing not configured ⇒ friendly "Billing is not configured yet."

### Upgrade prompt
`lib/api.ts` error mapper exposes `error.details` and `BILLING.LIMIT_REACHED` / `BILLING.FEATURE_REQUIRED`. A small shared `UpgradeNotice` component renders with the usage counts from `details`; surfaced on the boards empty-state and the members tab when the limit code arrives.

### Activity tab
"Export audit log" button visible when the plan includes `AUDIT_LOG_EXPORT`; downloads CSV or JSON from the export endpoint.

### Admin back-office
- Remove `AdminService.STUB_SUBSCRIPTION` and `GET /admin/users/:id/subscription`.
- New `GET /admin/workspaces/:id/subscription` returning real plan/status/period-end (+ seat count). Fixes the existing ws-id-passed-as-user-id inconsistency.
- Admin page subscription cell reads it (stays `isAdmin`-gated).

## 10. Intentional design decisions (not defects)

- **`null` = unlimited** when defining plan limits (rather than `-1` or an `Infinity` sentinel). Code paths treat non-null numbers as hard caps; `null` short-circuits the check. Explicit, typed, and greppable.
- **Seats = ACTIVE members only**, deliberately different from the existing `memberCount` stats value.
- **Over-limit workspaces are allowed to persist** after downgrade; only new mutations are blocked.

## 11. Out of scope / tracked follow-ups

- **Metered per-seat billing (Stripe usage records).** This phase bills fixed quantity = current ACTIVE seats at checkout time and lets customers adjust via the Billing Portal. Auto-scaling the subscription quantity as members join/leave is a real follow-up (tracked) — not faked in this skeleton.
- Price finalization (`TODO: confirm pricing` in constants + Stripe dashboard price IDs).
- SSO (feature flag only; wired when OAuth exists).
- Team "admin access" to the back-office (back-office remains `isAdmin`-gated; the flag `FEATURE.ADMIN_TOOLS` is inert this phase).
- Free-plan "promotion" copy, usage emails, dunning, trial logic.

## 12. Tests & verification

- `UsageService` boundary matrix: FREE (boards 3 / members 3 / owned 1), PRO and TEAM unlimited; `null`-limit short-circuit; exact-boundary (at limit ⇒ throws, under ⇒ ok).
- `BillingController`: role enforcement, plan param validation, `NOT_CONFIGURED` when keys absent, portal-before-customer ⇒ `NO_CUSTOMER`.
- `StripeService` (mocked SDK): checkout/portal return URLs; missing keys ⇒ `NOT_CONFIGURED`.
- Webhook idempotency: (a) same event twice ⇒ second is a 200 no-op, handler called once; (b) handler failure releases the claim ⇒ retried on next delivery; (c) bad signature ⇒ 400.
- Audit export gating: non-Team ⇒ `BILLING.FEATURE_REQUIRED`; Team ⇒ returns rows.
- Migration: `drizzle-kit generate` + apply against a fresh Postgres (podman locally; the CI postgres service already runs `pnpm migrate`).
- Live Stripe test-mode round-trip: **BLOCKED on provided keys** (see below) — not runnable from here.

## 13. Blocked points (flag b)

Exact point where real Stripe keys are required:

1. **`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`** — needed to (a) flake out a live Checkout session that Stripe redirects to, (b) deliver a real webhook to a public URL (Render), and (c) round-trip `checkout.session.completed` → subscription persisted → settings UI reflects it. Everything before that (data model, guard logic, idempotency, UI, unit tests) is buildable and testable without them.
2. **Public webhook URL**: `https://workspace-api-8387.onrender.com/api/v1/billing/webhook` must be registered in the Stripe dashboard, which the user does once keys are provided.

Deploy note: `render.yaml` needs no change for this phase — all Stripe env is optional; when keys are supplied they get added as Render env vars (`sync: false`) and the webhook endpoint registered.