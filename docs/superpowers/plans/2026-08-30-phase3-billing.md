# Phase 3: Stripe Billing & Usage Limits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-scoped Stripe subscriptions (Free/Pro/Team) with server-enforced usage limits, a Team-only audit-log export differentiator, workspace billing UI, and live admin plan lookup — replacing the admin subscription stub.

**Architecture:** A `@Global()` `BillingModule` owns subscriptions, webhook idempotency, plan gates, and Stripe calls. A pure `BillingPolicy` decides limits; `UsageService` asserts them at the existing mutation points (`workspaces`, `boards`); a signing-verified webhook applies Stripe events idempotently and audits each plan change. The web app reads one new `GET /workspaces/:workspaceId/subscription` endpoint and renders plan/usage UI + the Team export button.

**Tech Stack:** NestJS (API), drizzle-orm + postgres (`@repo/database`), `stripe` SDK (added to `apps/api`), class-validator DTOs, Zod env schema, React/Next.js (`apps/web`), Jest.

## Global Constraints

- Block-new-keep-existing: NEVER force-downgrade or remove anything. On FREE, block creating the 4th board, the 4th ACTIVE member invitation, and the 2nd owned workspace. Overages persist (keep-existing) and are surfaced in UI. Deletions/removals/transfers-out are never blocked.
- Seats = ACTIVE `workspace_members` only (status `'ACTIVE'`).
- FREE limits: boards 3, members 3, ownedWorkspaces 1. PRO/TEAM: unlimited (`null` offset sentinel). TEAM features `[AUDIT_LOG_EXPORT, SSO, ADMIN_TOOLS]`; only `AUDIT_LOG_EXPORT` is enforced.
- Board count = boards with `deleted_at IS NULL` (archived boards still count — archive is not removal). Member count = `status='ACTIVE'`. Owned count = workspaces with `owner_id=$user AND deleted_at IS NULL` (archived still owned).
- Prices are placeholders `0` marked with `// TODO: confirm pricing` everywhere they appear. Price IDs come from env (`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_TEAM_MONTHLY`).
- All 4 Stripe env vars are optional at boot EXCEPT: when `STRIPE_SECRET_KEY` is set, `STRIPE_WEBHOOK_SECRET` is REQUIRED (validate at boot, folded-in check).
- `billing.subscription_changed` audit events must carry a real `userId` (the workspace owner) — `audit_events.user_id` is `NOT NULL` with `ON DELETE RESTRICT` FK to `users`.
- Stripe SDK API surface: `stripe.checkout.sessions.create`, `stripe.billingPortal.sessions.create`, `stripe.webhooks.constructEvent`; client constructed once (lazy). No account sync, no usage records (metered per-seat billing is an explicit follow-up, NOT built).
- TDD for all production code: failing test first, then minimal implementation. Conventional commits (`feat(billing): …`, `fix(web): …`). Husk runs turbo lint on commits.
- Verification commands (used throughout): api — `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter api lint` (baseline 25 warnings only in `ai.service.spec.ts` + `canvas.service.spec.ts`); web — `rm -rf apps/web/.next && pnpm --filter web lint`, `pnpm --filter web check-types`, `pnpm --filter web build`.
- podman can run Postgres 17 on `127.0.0.1:5433` matching `.env` `DATABASE_URL=postgresql://workspace:workspace123@localhost:5433/workspace` for migration verification. CI already runs `pnpm migrate` against a Postgres service.
- Env vars are read ONLY via `apps/api/src/config/env.schema.ts` + `configuration.ts` (blueprint rule). Never touch `process.env` elsewhere.

**Notable deviations from the design doc (deliberate — not defects):**

1. **UsageRepository (billing-owned) replaces the two repo additions** called for in design §4 (`countActiveByWorkspace` on workspace-members, owned-count on workspaces). `WorkspacesModule`/`BoardsModule` do not export their repositories, so injecting them from billing would create cycles. The billing module's own `UsageRepository` runs the same raw-DB counts; behavior is identical and it satisfies the same locked decisions.
2. **Webhook idempotency uses a status-column ledger** (PROCESSING/COMPLETED/FAILED) instead of design §5's claim+delete. External behavior is identical (second delivery ⇒ 2xx no-op; handler failure ⇒ 5xx so Stripe retries; bad signature ⇒ 400 `WEBHOOK_INVALID`) and it adds replay/failure visibility. Related: the webhook-log table's `id` IS the Stripe event id (text PK), folding design §3's separate `eventId` column into the key — Stripe's id is already globally unique.
3. **`AuditExportController` lives in the billing module** (design §7 said audit module) so it can inject `UsageService` and gate on the Team feature — same `≥ ADMIN` guard as design §7, same route.
4. **Dedicated `AuditRepository.listAllByWorkspace`** for exports instead of design §7's "reuse `listByWorkspace`": that existing method is bounded and would silently truncate an export. The unbounded variant is used only by the export path.

---

### Task 1: Billing database schema + migration + backfill

**Files:**
- Create: `packages/database/src/schema/enums/billing.enums.ts`
- Modify: `packages/database/src/schema/enums/index.ts`
- Create: `packages/database/src/schema/billing/workspace-subscription.schema.ts`
- Create: `packages/database/src/schema/billing/stripe-webhook-event.schema.ts`
- Create: `packages/database/src/schema/billing/index.ts`
- Modify: `packages/database/src/schema/index.ts`
- Generated: `packages/database/src/migrations/*.sql` (by `pnpm --filter @repo/database generate` — `drizzle.config.ts` sets `out: "./src/migrations"`)

**Interfaces:**
- Consumes: `PRIMARY_ID`, `CREATED_AT`, `UPDATED_AT` from `@repo/database` (`common.ts`); `workspaces` table; the `index.ts` re-export convention.
- Produces: tables `workspaceSubscriptions` and `stripeWebhookEvents` with types `WorkspaceSubscriptionRow`, `NewWorkspaceSubscriptionRow`, `StripeWebhookEventRow`, `NewStripeWebhookEventRow`; enum types `SubscriptionPlan`, `SubscriptionStatus`, `WebhookEventStatus` — all exported from `@repo/database`.

- [ ] **Step 1: Create the billing enum file**

Create `packages/database/src/schema/enums/billing.enums.ts` (mirror `workspace.enums.ts`):

```ts
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Commercial plans. FREE is the default tier; PRO and TEAM are billed via
 * Stripe. `null` limits in `PLAN_LIMITS` on the API side mean "unlimited".
 */
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['FREE', 'PRO', 'TEAM']);

export type SubscriptionPlan = (typeof subscriptionPlanEnum.enumValues)[number];

/**
 * Mirror of a Stripe subscription's lifecycle status. A FREE row is always
 * ACTIVE; paid rows track Stripe's states (canceled ⇒ back to FREE plan).
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'ACTIVE',
  'CANCELED',
  'PAST_DUE',
  'UNPAID',
  'TRIALING',
  'INCOMPLETE',
]);

export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];

/**
 * Idempotency lifecycle for processed Stripe webhook events.
 */
export const webhookEventStatusEnum = pgEnum('stripe_webhook_event_status', [
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export type WebhookEventStatus = (typeof webhookEventStatusEnum.enumValues)[number];
```

- [ ] **Step 2: Register the enums**

In `packages/database/src/schema/enums/index.ts`, add `export * from './billing.enums.js';` (after the `canvas.enums.js` line).

- [ ] **Step 3: Create the subscription table schema**

Create `packages/database/src/schema/billing/workspace-subscription.schema.ts`:

```ts
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { CREATED_AT, PRIMARY_ID, UPDATED_AT } from '../common.js';
import { subscriptionPlanEnum, subscriptionStatusEnum } from '../enums/billing.enums.js';
import { workspaces } from '../workspaces/workspace.schema.js';

import { workspaceSubscriptionAlias, workspaceSubscriptionsTableName } from './billing.constants.js';

/**
 * One billing row per workspace. The row is created FREE/ACTIVE when a
 * workspace is created (and backfilled for pre-existing workspaces by the
 * migration). Stripe webhooks upsert this row; the app never writes plan
 * changes directly.
 */
export const workspaceSubscriptions = pgTable(
  workspaceSubscriptionsTableName,
  {
    id: PRIMARY_ID(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    plan: subscriptionPlanEnum('plan').notNull().default('FREE'),
    status: subscriptionStatusEnum('status').notNull().default('ACTIVE'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true, mode: 'date' }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }),
    canceledAt: timestamp('canceled_at', { withTimezone: true, mode: 'date' }),
    createdAt: CREATED_AT(),
    updatedAt: UPDATED_AT(),
  },
  (table) => ({
    workspaceSubscriptionsWorkspaceUnique: uniqueIndex('workspace_subscriptions_workspace_unique')
      .on(table.workspaceId),
    workspaceSubscriptionsStripeSubIdx: index('workspace_subscriptions_stripe_sub_idx')
      .on(table.stripeSubscriptionId),
  }),
);

export type WorkspaceSubscriptionRow = typeof workspaceSubscriptions.$inferSelect;
export type NewWorkspaceSubscriptionRow = typeof workspaceSubscriptions.$inferInsert;

export const workspaceSubscriptionAccess = {
  table: workspaceSubscriptions,
  alias: workspaceSubscriptionAlias,
};
```

Create `packages/database/src/schema/billing/billing.constants.ts`:

```ts
export const workspaceSubscriptionsTableName = 'workspace_subscriptions';
export const workspaceSubscriptionAlias = 'workspace_subscription';

export const stripeWebhookEventsTableName = 'stripe_webhook_events';
export const stripeWebhookEventAlias = 'stripe_webhook_event';
```

- [ ] **Step 4: Create the webhook-event table schema**

Create `packages/database/src/schema/billing/stripe-webhook-event.schema.ts`:

```ts
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { CREATED_AT } from '../common.js';
import { webhookEventStatusEnum } from '../enums/billing.enums.js';
import { workspaces } from '../workspaces/workspace.schema.js';

import { stripeWebhookEventAlias, stripeWebhookEventsTableName } from './billing.constants.js';

/**
 * Idempotency ledger for Stripe webhook delivery. `id` is Stripe's own
 * event id — safe as PK because Stripe guarantees delivery dedup is the
 * receiving side's job. PROCESSING/FAILED rows are re-processed on retry;
 * COMPLETED rows are skipped.
 */
export const stripeWebhookEvents = pgTable(
  stripeWebhookEventsTableName,
  {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: webhookEventStatusEnum('status').notNull().default('PROCESSING'),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    createdAt: CREATED_AT(),
  },
  (table) => ({
    stripeWebhookEventsWorkspaceIdx: index('stripe_webhook_events_workspace_idx')
      .on(table.workspaceId),
  }),
);

export type StripeWebhookEventRow = typeof stripeWebhookEvents.$inferSelect;
export type NewStripeWebhookEventRow = typeof stripeWebhookEvents.$inferInsert;

export const stripeWebhookEventAccess = {
  table: stripeWebhookEvents,
  alias: stripeWebhookEventAlias,
};
```

- [ ] **Step 5: Export the billing schema folder**

Create `packages/database/src/schema/billing/index.ts`:

```ts
export * from './billing.constants.js';
export * from './workspace-subscription.schema.js';
export * from './stripe-webhook-event.schema.js';
```

In `packages/database/src/schema/index.ts`, add `export * from './billing/index.js';` after the `checklists` line (foreign keys reference earlier tables, so keep it last).

- [ ] **Step 6: Generate the migration**

Run: `pnpm --filter @repo/database generate`
Expected: a new `.sql` file under `packages/database/src/migrations/` creating the two enums, two tables, and three indexes.

- [ ] **Step 7: Append the FREE-plan backfill to the generated migration**

Pre-existing workspaces have no subscription row. Open the generated migration `.sql` and append BEFORE the final `--> statement-breakpoint` (so it runs in the same migration after all tables exist):

```sql
INSERT INTO workspace_subscriptions (id, workspace_id, plan, status)
SELECT gen_random_uuid(), id, 'FREE', 'ACTIVE'
FROM workspaces
WHERE deleted_at IS NULL;
```

IMPORTANT (post-review fix): the `id` column MUST be supplied here. `PRIMARY_ID()` gives the id via a drizzle client-side `$defaultFn(() => uuidv7())`, which produces NO SQL-level default — the migration emits `"id" uuid PRIMARY KEY NOT NULL` with no `DEFAULT`. So a raw-SQL backfill that omits `id` fails with `null value in column "id"` on any non-empty DB (this only masked on an empty DB where 0 rows are inserted). `gen_random_uuid()` is built-in on PG13+ (PG17 here), so it needs no pgcrypto dependency. Backfilled ids are UUIDv4 while app inserts are UUIDv7 — both are valid unique uuids against the `uuid` column type, so this is acceptable.

NOTE: drizzle-kit migrations are forward-only — this repo's `.sql` files (see `0006_bent_prowler.sql`) contain no DOWN section, so do NOT add one. The new pgEnums (`subscription_plan`, `subscription_status`, `stripe_webhook_event_status`) are managed by drizzle-kit's journal; there is no manual downgrade here.

- [ ] **Step 8: Verify against a real Postgres (podman)**

Run:
```bash
podman run -d --name pg-billing -e POSTGRES_USER=workspace -e POSTGRES_PASSWORD=workspace123 -e POSTGRES_DB=workspace -p 127.0.0.1:5433:5432 docker.io/library/postgres:17
DATABASE_URL=postgresql://workspace:workspace123@localhost:5433/workspace pnpm --filter @repo/database build && DATABASE_URL=postgresql://workspace:workspace123@localhost:5433/workspace pnpm --filter @repo/database migrate
```
Then run two checks:
```bash
docker exec pg-billing psql -U workspace -d workspace -c "SELECT count(*) FROM workspace_subscriptions;"
docker exec pg-billing psql -U workspace -d workspace -c "SELECT count(*) FROM workspaces WHERE deleted_at IS NULL;"
```
Expected: the two counts are equal (every live workspace got a FREE row), exit codes 0. Clean up with `podman rm -f pg-billing` (the used container is reusable for later tasks).

- [ ] **Step 9: Commit**

```bash
git add packages/database/src/schema
git add packages/database/src/migrations
git commit -m "feat(database): add billing subscription and stripe webhook schemas"
```

---

### Task 2: Envelope details passthrough (api + web error mapper)

**Files:**
- Modify: `apps/api/src/common/exceptions/business.exception.ts`
- Modify: `apps/api/src/common/filters/business-exception.filter.ts`
- Test: Create `apps/api/src/common/filters/business-exception.filter.spec.ts`
- Modify: `apps/web/lib/api.ts` (the folded-in error-mapper fix — limit errors must surface `error.code` and `error.details`)

**Interfaces:**
- Consumes: current `BusinessException` (code/message/status, no details) and the global filter envelope `{ success, message, error: { code }, path }`.
- Produces: `BusinessException` optionally carries `details`; filter emits `error.details` when present; web `ApiError` gains an optional `details` field and reads `error.code` correctly.

- [ ] **Step 1: Write the failing filter test**

Create `apps/api/src/common/filters/business-exception.filter.spec.ts`:

```ts
import { ArgumentsHost } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';

class TestException extends BusinessException {
  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(code, message, status, details);
  }
}

describe('BusinessExceptionFilter', () => {
  let filter: BusinessExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;

  // NOTE: import { BusinessExceptionFilter } from './business-exception.filter';
  beforeEach(() => {
    filter = new BusinessExceptionFilter();
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url: '/api/v1/test', method: 'GET' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('includes error.details when the exception carries them', () => {
    filter.catch(new TestException('BILLING.LIMIT_REACHED', 'Plan limit reached.', 422, { feature: 'boards', current: 3, limit: 3, plan: 'FREE' }), host);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'BILLING.LIMIT_REACHED', details: expect.objectContaining({ feature: 'boards', current: 3 }) }),
      }),
    );
  });

  it('omits error.details when the exception has none', () => {
    filter.catch(new TestException('TEST.CODE', 'plain', 409), host);
    const body = response.json.mock.calls[0][0];
    expect(body.error).toEqual({ code: 'TEST.CODE' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test apps/api/src/common/filters/business-exception.filter.spec.ts 2>/dev/null || pnpm --filter api test`
Note: this repo uses a Jest rootDir of `apps/api`; run the whole api suite if you are unsure of the single-file invocation: `pnpm --filter api test`.
Expected: FAIL — `details` has no effect (filter drops it), so the assertions on `error.details` fail.

- [ ] **Step 3: Implement details passthrough in the exception**

In `apps/api/src/common/exceptions/business.exception.ts`, change the class to:

```ts
export abstract class BusinessException extends HttpException {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  protected constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(details ? { code, message, details } : { code, message }, status);
    this.code = code;
    if (details) this.details = details;
  }
}
```

- [ ] **Step 4: Implement details passthrough in the filter**

In `apps/api/src/common/filters/business-exception.filter.ts`, inside the `HttpException` branch, after `const message = …`, add:

```ts
      const details =
        typeof body === 'object' && body !== null && 'details' in body
          ? (body as { details?: Record<string, unknown> }).details
          : undefined;
```

And change the success shape to conditionally include details:

```ts
      response.status(status).json({
        success: false,
        message,
        error: details ? { code, details } : { code },
        path: request.url,
      });
```

- [ ] **Step 5: Run the filter test again**

Run: `pnpm --filter api test`
Expected: PASS (both new specs), no regressions.

- [ ] **Step 6: Fix the web error mapper (drives the limit-errors UX)**

In `apps/web/lib/api.ts`, change the `ApiError` class to:

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

Change BOTH `request<T>` and `requestFormData<T>` error branches (`apps/web/lib/api.ts:134-141` and `apps/web/lib/api.ts:210-217` — they are identical) from reading `body.code` to:

```ts
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = (body?.error ?? body) as {
      code?: string;
      details?: Record<string, unknown>;
      message?: string;
    };
    throw new ApiError(
      res.status,
      err.code || 'UNKNOWN',
      err.message || body?.message || 'An error occurred',
      err.details,
    );
  }
```

This is the folded-in fix: the API envelope puts the code at `body.error.code`, so the old `body.code` always produced `'UNKNOWN'`.

- [ ] **Step 7: Verify web types**

Run: `rm -rf apps/web/.next && pnpm --filter web check-types`
Expected: PASS (no other web code depends on the old `ApiError` arity — verified: no `.code` reads outside `lib/api.ts`).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/common apps/web/lib/api.ts
git commit -m "fix: surface business error codes and details to clients"
```

---

### Task 3: Billing domain constants, errors, and pure policy

**Files:**
- Create: `apps/api/src/modules/billing/billing.constants.ts`
- Create: `apps/api/src/modules/billing/errors/billing.errors.ts`
- Create: `apps/api/src/modules/billing/policies/billing.policy.ts`
- Test: `apps/api/src/modules/billing/policies/billing.policy.spec.ts`
- Test: `apps/api/src/modules/billing/errors/billing.errors.spec.ts`

**Interfaces:**
- Consumes: `BusinessException` (Task 2); `SubscriptionPlan`, `SubscriptionStatus` from `@repo/database`.
- Produces: `BillingPlan`, `PRICED_PLANS`, `PricedPlan`, `PLAN_LIMITS`, `PLAN_FEATURES`, `BILLING_FEATURES`, `PLACEHOLDER_PRICES`, `PLAN_LABELS` (constants); `BillingErrorCode`, `BillingException`, `LimitReachedException`, `FeatureRequiredException` (errors); `BillingPolicy` (pure) with methods `canCreateBoard`, `canAddMember`, `canOwnWorkspace`, `hasFeature`, `highestPlan`.

- [ ] **Step 1: Write the failing policy tests**

Create `apps/api/src/modules/billing/policies/billing.policy.spec.ts`:

```ts
import { BillingPolicy } from './billing.policy';

describe('BillingPolicy', () => {
  const policy = new BillingPolicy();

  describe('canCreateBoard', () => {
    it('allows on FREE while under 3', () => {
      expect(policy.canCreateBoard('FREE', 0)).toBe(true);
      expect(policy.canCreateBoard('FREE', 2)).toBe(true);
    });
    it('blocks on FREE at the 3-board limit', () => {
      expect(policy.canCreateBoard('FREE', 3)).toBe(false);
      expect(policy.canCreateBoard('FREE', 9)).toBe(false);
    });
    it('is unlimited on PRO and TEAM', () => {
      expect(policy.canCreateBoard('PRO', 100)).toBe(true);
      expect(policy.canCreateBoard('TEAM', 1000)).toBe(true);
    });
  });

  describe('canAddMember', () => {
    it('blocks on FREE at 3 active seats', () => {
      expect(policy.canAddMember('FREE', 3)).toBe(false);
      expect(policy.canAddMember('FREE', 2)).toBe(true);
    });
    it('is unlimited on paid plans', () => {
      expect(policy.canAddMember('PRO', 300)).toBe(true);
    });
  });

  describe('canOwnWorkspace', () => {
    it('allows owning exactly 1 workspace on FREE', () => {
      expect(policy.canOwnWorkspace('FREE', 1)).toBe(false);
      expect(policy.canOwnWorkspace('FREE', 0)).toBe(true);
    });
    it('is unlimited on paid plans', () => {
      expect(policy.canOwnWorkspace('PRO', 20)).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('gates AUDIT_LOG_EXPORT to TEAM', () => {
      expect(policy.hasFeature('FREE', 'AUDIT_LOG_EXPORT')).toBe(false);
      expect(policy.hasFeature('PRO', 'AUDIT_LOG_EXPORT')).toBe(false);
      expect(policy.hasFeature('TEAM', 'AUDIT_LOG_EXPORT')).toBe(true);
    });
    it('exposes SSO and ADMIN_TOOLS flags on TEAM', () => {
      expect(policy.hasFeature('TEAM', 'SSO')).toBe(true);
      expect(policy.hasFeature('TEAM', 'ADMIN_TOOLS')).toBe(true);
    });
  });

  describe('highestPlan', () => {
    it('returns the highest plan in a list', () => {
      expect(policy.highestPlan(['FREE', 'PRO'])).toBe('PRO');
      expect(policy.highestPlan(['PRO', 'TEAM', 'FREE'])).toBe('TEAM');
      expect(policy.highestPlan(['FREE'])).toBe('FREE');
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL — `./billing.policy` does not exist (import errors) and the module isn't compiled.

- [ ] **Step 3: Write the failing error-code tests**

Create `apps/api/src/modules/billing/errors/billing.errors.spec.ts`:

```ts
import { BusinessException } from '../../../common/exceptions/business.exception';
import { BillingErrorCode, BillingException, FeatureRequiredException, LimitReachedException } from './billing.errors';

describe('billing errors', () => {
  it('BillingException extends BusinessException and exposes details', () => {
    const ex = new BillingException(BillingErrorCode.NO_CUSTOMER, 'nope', 409, { x: 1 });
    expect(ex).toBeInstanceOf(BusinessException);
    expect(ex.code).toBe('BILLING.NO_CUSTOMER');
    expect(ex.details).toEqual({ x: 1 });
    expect(ex.getStatus()).toBe(409);
  });

  it('LimitReachedException is 422 with structured details', () => {
    const ex = new LimitReachedException({ feature: 'members', current: 3, limit: 3, plan: 'FREE' });
    expect(ex.getStatus()).toBe(422);
    expect(ex.details).toMatchObject({ feature: 'members', current: 3, limit: 3, plan: 'FREE' });
  });

  it('FeatureRequiredException is 422 with feature + plan', () => {
    const ex = new FeatureRequiredException({ feature: 'AUDIT_LOG_EXPORT', plan: 'PRO' });
    expect(ex.getStatus()).toBe(422);
    expect(ex.code).toBe('BILLING.FEATURE_REQUIRED');
  });
});
```

- [ ] **Step 4: Create the constants file**

Create `apps/api/src/modules/billing/billing.constants.ts`:

```ts
import type { SubscriptionPlan } from '@repo/database';

export type BillingPlan = SubscriptionPlan;

export const PRICED_PLANS = ['PRO', 'TEAM'] as const;
export type PricedPlan = (typeof PRICED_PLANS)[number];
export function isPricedPlan(value: string | undefined): value is PricedPlan {
  return value === 'PRO' || value === 'TEAM';
}

export const PLAN_RANK: Record<BillingPlan, number> = { FREE: 0, PRO: 1, TEAM: 2 };

export type PlanLimits = { boards: number | null; members: number | null; ownedWorkspaces: number | null };

export const PLAN_LIMITS: Record<BillingPlan, PlanLimits> = {
  FREE: { boards: 3, members: 3, ownedWorkspaces: 1 },
  PRO: { boards: null, members: null, ownedWorkspaces: null },
  TEAM: { boards: null, members: null, ownedWorkspaces: null },
};

export const BILLING_FEATURES = {
  AUDIT_LOG_EXPORT: 'AUDIT_LOG_EXPORT',
  SSO: 'SSO',
  ADMIN_TOOLS: 'ADMIN_TOOLS',
} as const;
export type BillingFeature = (typeof BILLING_FEATURES)[keyof typeof BILLING_FEATURES];

export const PLAN_FEATURES: Record<BillingPlan, readonly BillingFeature[]> = {
  FREE: [],
  PRO: [],
  TEAM: [BILLING_FEATURES.AUDIT_LOG_EXPORT, BILLING_FEATURES.SSO, BILLING_FEATURES.ADMIN_TOOLS],
};

export const PLACEHOLDER_PRICES: Record<PricedPlan, { monthly: number }> = {
  // TODO: confirm pricing before launch
  PRO: { monthly: 0 },
  TEAM: { monthly: 0 },
};

export const PLAN_LABELS: Record<BillingPlan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
};
```

- [ ] **Step 5: Create the errors file**

Create `apps/api/src/modules/billing/errors/billing.errors.ts`:

```ts
import { BusinessException } from '../../../common/exceptions/business.exception';

export const BillingErrorCode = {
  NOT_CONFIGURED: 'BILLING.NOT_CONFIGURED',
  LIMIT_REACHED: 'BILLING.LIMIT_REACHED',
  FEATURE_REQUIRED: 'BILLING.FEATURE_REQUIRED',
  NO_CUSTOMER: 'BILLING.NO_CUSTOMER',
  PLAN_NOT_FOUND: 'BILLING.PLAN_NOT_FOUND',
  WEBHOOK_INVALID: 'BILLING.WEBHOOK_INVALID',
  FORBIDDEN: 'BILLING.FORBIDDEN',
} as const;
export type BillingErrorCodeValue = (typeof BillingErrorCode)[keyof typeof BillingErrorCode];

export class BillingException extends BusinessException {
  constructor(
    code: BillingErrorCodeValue,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(code, message, status, details);
  }
}

export class LimitReachedException extends BillingException {
  constructor(details: { feature: string; current: number; limit: number; plan: string }) {
    super(BillingErrorCode.LIMIT_REACHED, 'Plan limit reached.', 422, details);
  }
}

export class FeatureRequiredException extends BillingException {
  constructor(details: { feature: string; plan: string }) {
    super(BillingErrorCode.FEATURE_REQUIRED, 'This feature is not included in your plan.', 422, details);
  }
}
```

- [ ] **Step 6: Create the pure policy**

Create `apps/api/src/modules/billing/policies/billing.policy.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { PLAN_FEATURES, PLAN_LIMITS, PLAN_RANK, type BillingFeature, type BillingPlan } from '../billing.constants';

/**
 * Pure decision logic for plan limits and feature gating. No I/O.
 * Services ask the policy BEFORE hitting the database where possible,
 * and after counting where they need facts.
 */
@Injectable()
export class BillingPolicy {
  public canCreateBoard(plan: BillingPlan, currentBoards: number): boolean {
    const limit = PLAN_LIMITS[plan].boards;
    return limit === null || currentBoards < limit;
  }

  public canAddMember(plan: BillingPlan, currentActiveSeats: number): boolean {
    const limit = PLAN_LIMITS[plan].members;
    return limit === null || currentActiveSeats < limit;
  }

  public canOwnWorkspace(plan: BillingPlan, currentOwned: number): boolean {
    const limit = PLAN_LIMITS[plan].ownedWorkspaces;
    return limit === null || currentOwned < limit;
  }

  public hasFeature(plan: BillingPlan, feature: BillingFeature): boolean {
    return PLAN_FEATURES[plan].includes(feature);
  }

  public highestPlan(plans: BillingPlan[]): BillingPlan {
    return plans.reduce<BillingPlan>((acc, p) => (PLAN_RANK[p] > PLAN_RANK[acc] ? p : acc), 'FREE');
  }
}
```

(Verification: `apps/api/src/modules/workspaces/policies/workspace.policy.ts` is a bare `@Injectable()` with no scope option and no `@Inject` — mirrored above.)

- [ ] **Step 7: Run tests**

Run: `pnpm --filter api test`
Expected: PASS — `billing.errors.spec.ts` and `billing.policy.spec.ts` green; policy assertions on FREE/PRO/TEAM and features all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/billing
git commit -m "feat(billing): add plan constants, error codes, and pure plan policy"
```

---

### Task 4: Billing repositories

**Files:**
- Create: `apps/api/src/modules/billing/data/billing.repository.ts`
- Create: `apps/api/src/modules/billing/data/usage.repository.ts`
- Create: `apps/api/src/modules/billing/data/stripe-webhook-events.repository.ts`

**Interfaces:**
- Consumes: `DATABASE` token, `Db`, `DbExecutor`, tables `workspaceSubscriptions`, `workspaceMembers`, `boards`, `workspaces`, `stripeWebhookEvents`, `sql`, `and`, `eq` from `@repo/database`; `BillingPlan`, `PricedPlan`, `isPricedPlan` from `billing.constants`.
- Produces:
  - `BillingRepository.findByWorkspace(workspaceId): Promise<WorkspaceSubscriptionRow | undefined>`
  - `BillingRepository.findByStripeSubscription(stripeSubscriptionId): Promise<WorkspaceSubscriptionRow | undefined>`
  - `BillingRepository.findPlansByOwner(userId): Promise<BillingPlan[]>`
  - `BillingRepository.createFree(workspaceId, tx?): Promise<WorkspaceSubscriptionRow | undefined>`
  - `BillingRepository.upsertFromStripe(data): Promise<WorkspaceSubscriptionRow>`
  - `BillingRepository.updateStripeData(id, data): Promise<WorkspaceSubscriptionRow>`
  - `UsageRepository.countActiveSeats(workspaceId): Promise<number>`
  - `UsageRepository.countBoards(workspaceId): Promise<number>`
  - `UsageRepository.countOwnedWorkspaces(userId): Promise<number>`
  - `UsageRepository.findActiveMemberRole(workspaceId, userId): Promise<WorkspaceRole | undefined>`
  - `UsageRepository.findOwnerId(workspaceId): Promise<string | undefined>`
  - `StripeWebhookEventsRepository.findById(id): Promise<StripeWebhookEventRow | undefined>`
  - `StripeWebhookEventsRepository.create(row: NewStripeWebhookEventRow): Promise<StripeWebhookEventRow>`
  - `StripeWebhookEventsRepository.setStatus(id, status: 'COMPLETED' | 'FAILED'): Promise<void>`

These three repositories are verified by compile + the sqlite-free real-Postgres checks in Task 11; their behavior is exercised through the service/controller specs (Tasks 5, 7) with mocked repositories.

- [ ] **Step 1: Create BillingRepository**

Create `apps/api/src/modules/billing/data/billing.repository.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type Db,
  type DbExecutor,
  type NewWorkspaceSubscriptionRow,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type WorkspaceSubscriptionRow,
  workspaces,
  workspaceSubscriptions,
} from '@repo/database';

@Injectable()
export class BillingRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async findByWorkspace(workspaceId: string): Promise<WorkspaceSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaceSubscriptions)
      .where(eq(workspaceSubscriptions.workspaceId, workspaceId))
      .limit(1);
    return row;
  }

  public async findByStripeSubscription(
    stripeSubscriptionId: string,
  ): Promise<WorkspaceSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaceSubscriptions)
      .where(eq(workspaceSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    return row;
  }

  public async findPlansByOwner(userId: string): Promise<SubscriptionPlan[]> {
    const rows = await this.db
      .select({ plan: workspaceSubscriptions.plan })
      .from(workspaceSubscriptions)
      .innerJoin(workspaces, eq(workspaces.id, workspaceSubscriptions.workspaceId))
      .where(and(eq(workspaces.ownerId, userId), sql`${workspaces.deletedAt} IS NULL`));
    return rows.map((r) => r.plan);
  }

  public async createFree(
    workspaceId: string,
    tx?: DbExecutor,
  ): Promise<WorkspaceSubscriptionRow | undefined> {
    const exec = tx ?? this.db;
    const row: NewWorkspaceSubscriptionRow = { workspaceId, plan: 'FREE', status: 'ACTIVE' };
    const [created] = await exec
      .insert(workspaceSubscriptions)
      .values(row)
      .onConflictDoNothing()
      .returning();
    return created;
  }

  public async upsertFromStripe(
    data: {
      workspaceId: string;
      plan: SubscriptionPlan;
      status: SubscriptionStatus;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
    },
  ): Promise<WorkspaceSubscriptionRow> {
    const [row] = await this.db
      .insert(workspaceSubscriptions)
      .values({
        workspaceId: data.workspaceId,
        plan: data.plan,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        currentPeriodStart: data.currentPeriodStart ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
      })
      .onConflictDoUpdate({
        target: workspaceSubscriptions.workspaceId,
        set: {
          plan: data.plan,
          status: data.status,
          stripeCustomerId: data.stripeCustomerId ?? null,
          stripeSubscriptionId: data.stripeSubscriptionId ?? null,
          currentPeriodStart: data.currentPeriodStart ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('Failed to upsert workspace subscription.');
    return row;
  }

  public async updateStripeData(
    id: string,
    data: {
      status: SubscriptionStatus;
      plan?: SubscriptionPlan;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      canceledAt?: Date | null;
    },
  ): Promise<WorkspaceSubscriptionRow> {
    const [row] = await this.db
      .update(workspaceSubscriptions)
      .set({
        status: data.status,
        ...(data.plan !== undefined ? { plan: data.plan } : {}),
        ...(data.currentPeriodStart !== undefined ? { currentPeriodStart: data.currentPeriodStart } : {}),
        ...(data.currentPeriodEnd !== undefined ? { currentPeriodEnd: data.currentPeriodEnd } : {}),
        ...(data.canceledAt !== undefined ? { canceledAt: data.canceledAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaceSubscriptions.id, id))
      .returning();
    if (!row) throw new Error('Failed to update workspace subscription.');
    return row;
  }
}
```

- [ ] **Step 2: Create UsageRepository**

Create `apps/api/src/modules/billing/data/usage.repository.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  sql,
  type Db,
  type WorkspaceRole,
  boards,
  workspaces,
  workspaceMembers,
} from '@repo/database';

@Injectable()
export class UsageRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async countActiveSeats(workspaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.status, 'ACTIVE')));
    return row?.count ?? 0;
  }

  public async countBoards(workspaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(boards)
      .where(and(eq(boards.workspaceId, workspaceId), sql`${boards.deletedAt} IS NULL`));
    return row?.count ?? 0;
  }

  public async countOwnedWorkspaces(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaces)
      .where(and(eq(workspaces.ownerId, userId), sql`${workspaces.deletedAt} IS NULL`));
    return row?.count ?? 0;
  }

  public async findActiveMemberRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole | undefined> {
    const [row] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    return row?.role;
  }

  public async findOwnerId(workspaceId: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    return row?.ownerId;
  }
}
```

- [ ] **Step 3: Create StripeWebhookEventsRepository**

Create `apps/api/src/modules/billing/data/stripe-webhook-events.repository.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE,
  eq,
  type Db,
  type NewStripeWebhookEventRow,
  type StripeWebhookEventRow,
  stripeWebhookEvents,
} from '@repo/database';

@Injectable()
export class StripeWebhookEventsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async findById(id: string): Promise<StripeWebhookEventRow | undefined> {
    const [row] = await this.db.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, id)).limit(1);
    return row;
  }

  public async create(row: NewStripeWebhookEventRow): Promise<StripeWebhookEventRow> {
    const [created] = await this.db.insert(stripeWebhookEvents).values(row).returning();
    if (!created) throw new Error('Failed to insert stripe webhook event.');
    return created;
  }

  public async setStatus(id: string, status: 'COMPLETED' | 'FAILED'): Promise<void> {
    await this.db
      .update(stripeWebhookEvents)
      .set({ status, processedAt: new Date() })
      .where(eq(stripeWebhookEvents.id, id));
  }
}
```

- [ ] **Step 4: Compile and commit**

Run: `pnpm --filter api build`
Expected: PASS. (Behavior is exercised in later task specs; the repositories themselves are integration-verified in Task 11 against podman Postgres.)

```bash
git add apps/api/src/modules/billing
git commit -m "feat(billing): add subscription, usage, and webhook-event repositories"
```

---

### Task 5: UsageService + BillingModule + enforcement at mutation points

**Files:**
- Create: `apps/api/src/modules/billing/services/usage.service.ts`
- Create: `apps/api/src/modules/billing/billing.module.ts`
- Test: `apps/api/src/modules/billing/services/usage.service.spec.ts`
- Modify: `apps/api/src/modules/boards/services/boards.service.ts` (both `create` methods)
- Modify: `apps/api/src/modules/workspaces/services/workspaces.service.ts` (`create`, `transferOwnership`, `createInvitation`)
- Modify: `apps/api/src/app.module.ts` (import `BillingModule`) — needed so global providers are registered

**Interfaces:**
- Consumes: `BillingRepository`, `UsageRepository` (Task 4), `BillingPolicy`, `PlanLimits`/`BillingPlan`/`WorkspaceRole`.
- Produces:
  - `UsageService.getSubscriptionView(workspaceId): Promise<SubscriptionView>`
  - `UsageService.assertCanCreateBoard(workspaceId): Promise<void>`
  - `UsageService.assertCanAddMember(workspaceId): Promise<void>`
  - `UsageService.assertCanOwnWorkspace(userId): Promise<void>`
  - `UsageService.requireFeature(workspaceId, feature): Promise<void>`
  - `UsageService.requireWorkspaceRole(workspaceId, userId, minRole: WorkspaceRole): Promise<void>`
  - `UsageService.countActiveSeats(workspaceId): Promise<number>`
  - `UsageService.findOwnerId(workspaceId): Promise<string | undefined>`
  - `type SubscriptionView = { workspaceId: string; plan: BillingPlan; status: SubscriptionStatus; currentPeriodEnd: Date | null }`

- [ ] **Step 1: Write the failing UsageService tests**

Create `apps/api/src/modules/billing/services/usage.service.spec.ts`:

```ts
import { type WorkspaceSubscriptionRow } from '@repo/database';

import { BillingRepository } from '../data/billing.repository';
import { UsageRepository } from '../data/usage.repository';
import { BillingPolicy } from '../policies/billing.policy';
import { BillingException } from '../errors/billing.errors';
import { UsageService } from './usage.service';

function freeRow(workspaceId: string): WorkspaceSubscriptionRow {
  return {
    id: 'sub-1',
    workspaceId,
    plan: 'FREE',
    status: 'ACTIVE',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    canceledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('UsageService', () => {
  let subs: { findByWorkspace: jest.Mock; findPlansByOwner: jest.Mock };
  let usage: {
    countActiveSeats: jest.Mock;
    countBoards: jest.Mock;
    countOwnedWorkspaces: jest.Mock;
    findActiveMemberRole: jest.Mock;
    findOwnerId: jest.Mock;
  };
  let service: UsageService;

  beforeEach(() => {
    subs = { findByWorkspace: jest.fn(), findPlansByOwner: jest.fn() };
    usage = {
      countActiveSeats: jest.fn(),
      countBoards: jest.fn(),
      countOwnedWorkspaces: jest.fn(),
      findActiveMemberRole: jest.fn(),
      findOwnerId: jest.fn(),
    };
    service = new UsageService(
      usage as unknown as UsageRepository,
      subs as unknown as BillingRepository,
      new BillingPolicy(),
    );
  });

  describe('getSubscriptionView', () => {
    it('returns the stored row mapped to a view', async () => {
      subs.findByWorkspace.mockResolvedValue({ ...freeRow('ws-1'), plan: 'PRO', currentPeriodEnd: new Date('2026-01-31T00:00:00Z') });
      const view = await service.getSubscriptionView('ws-1');
      expect(view).toMatchObject({ workspaceId: 'ws-1', plan: 'PRO', status: 'ACTIVE' });
      expect(view.currentPeriodEnd?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    });
    it('defaults a missing row to FREE/ACTIVE (backfill safety)', async () => {
      subs.findByWorkspace.mockResolvedValue(undefined);
      const view = await service.getSubscriptionView('legacy-1');
      expect(view).toMatchObject({ workspaceId: 'legacy-1', plan: 'FREE', status: 'ACTIVE' });
    });
  });

  describe('assertCanCreateBoard', () => {
    it('blocks the 4th board on FREE', async () => {
      subs.findByWorkspace.mockResolvedValue(freeRow('ws-1'));
      usage.countBoards.mockResolvedValue(3);
      await expect(service.assertCanCreateBoard('ws-1')).rejects.toMatchObject({
        code: 'BILLING.LIMIT_REACHED',
        details: { feature: 'boards', current: 3, limit: 3, plan: 'FREE' },
      });
    });
    it('allows creation on PRO regardless of count', async () => {
      subs.findByWorkspace.mockResolvedValue({ ...freeRow('ws-1'), plan: 'PRO' });
      usage.countBoards.mockResolvedValue(99);
      await expect(service.assertCanCreateBoard('ws-1')).resolves.toBeUndefined();
    });
  });

  describe('assertCanAddMember', () => {
    it('blocks an invitation above 3 active seats on FREE', async () => {
      subs.findByWorkspace.mockResolvedValue(freeRow('ws-1'));
      usage.countActiveSeats.mockResolvedValue(3);
      await expect(service.assertCanAddMember('ws-1')).rejects.toMatchObject({
        code: 'BILLING.LIMIT_REACHED',
        details: { feature: 'members', current: 3, limit: 3, plan: 'FREE' },
      });
    });
  });

  describe('assertCanOwnWorkspace', () => {
    it('blocks a second owned workspace when every owned sub is FREE', async () => {
      subs.findPlansByOwner.mockResolvedValue(['FREE', 'FREE']);
      usage.countOwnedWorkspaces.mockResolvedValue(1);
      await expect(service.assertCanOwnWorkspace('u-1')).rejects.toMatchObject({
        code: 'BILLING.LIMIT_REACHED',
        details: { feature: 'ownedWorkspaces', current: 1, limit: 1, plan: 'FREE' },
      });
    });
    it('allows many owned workspaces when the user owns a PAID workspace', async () => {
      subs.findPlansByOwner.mockResolvedValue(['PRO']);
      usage.countOwnedWorkspaces.mockResolvedValue(5);
      await expect(service.assertCanOwnWorkspace('u-1')).resolves.toBeUndefined();
    });
  });

  describe('requireFeature', () => {
    it('throws FEATURE_REQUIRED on PRO for AUDIT_LOG_EXPORT', async () => {
      subs.findByWorkspace.mockResolvedValue({ ...freeRow('ws-1'), plan: 'PRO' });
      await expect(service.requireFeature('ws-1', 'AUDIT_LOG_EXPORT')).rejects.toMatchObject({
        code: 'BILLING.FEATURE_REQUIRED',
        details: { feature: 'AUDIT_LOG_EXPORT', plan: 'PRO' },
      });
    });
    it('passes on TEAM', async () => {
      subs.findByWorkspace.mockResolvedValue({ ...freeRow('ws-1'), plan: 'TEAM' });
      await expect(service.requireFeature('ws-1', 'AUDIT_LOG_EXPORT')).resolves.toBeUndefined();
    });
  });

  describe('requireWorkspaceRole', () => {
    it('rejects non-members and below-ADMIN roles with FORBIDDEN', async () => {
      usage.findActiveMemberRole.mockResolvedValue('EDITOR');
      await expect(service.requireWorkspaceRole('ws-1', 'u-1', 'ADMIN')).rejects.toMatchObject({ code: 'BILLING.FORBIDDEN' });
      usage.findActiveMemberRole.mockResolvedValue(undefined);
      await expect(service.requireWorkspaceRole('ws-1', 'u-1', 'ADMIN')).rejects.toMatchObject({ code: 'BILLING.FORBIDDEN' });
    });
    it('accepts ADMIN and OWNER', async () => {
      usage.findActiveMemberRole.mockResolvedValue('OWNER');
      await expect(service.requireWorkspaceRole('ws-1', 'u-1', 'ADMIN')).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL — `./usage.service` doesn't exist yet.

- [ ] **Step 3: Implement UsageService**

Create `apps/api/src/modules/billing/services/usage.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import {
  WORKSPACE_ROLE_RANK,
  type SubscriptionStatus,
  type WorkspaceRole,
} from '@repo/database';

import { BillingRepository } from '../data/billing.repository';
import { UsageRepository } from '../data/usage.repository';
import { BillingPolicy } from '../policies/billing.policy';
import { BillingErrorCode, BillingException, FeatureRequiredException, LimitReachedException } from '../errors/billing.errors';
import { PLAN_LIMITS, type BillingFeature, type BillingPlan } from '../billing.constants';

export type SubscriptionView = {
  workspaceId: string;
  plan: BillingPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
};

@Injectable()
export class UsageService {
  constructor(
    @Inject(UsageRepository) private readonly repo: UsageRepository,
    @Inject(BillingRepository) private readonly subs: BillingRepository,
    @Inject(BillingPolicy) private readonly policy: BillingPolicy,
  ) {}

  public async getSubscriptionView(workspaceId: string): Promise<SubscriptionView> {
    const row = await this.subs.findByWorkspace(workspaceId);
    return {
      workspaceId,
      plan: row?.plan ?? 'FREE',
      status: row?.status ?? 'ACTIVE',
      currentPeriodEnd: row?.currentPeriodEnd ?? null,
    };
  }

  public async assertCanCreateBoard(workspaceId: string): Promise<void> {
    const plan = await this.planOf(workspaceId);
    const current = await this.repo.countBoards(workspaceId);
    if (!this.policy.canCreateBoard(plan, current)) {
      throw new LimitReachedException({ feature: 'boards', current, limit: PLAN_LIMITS[plan].boards as number, plan });
    }
  }

  public async assertCanAddMember(workspaceId: string): Promise<void> {
    const plan = await this.planOf(workspaceId);
    const current = await this.repo.countActiveSeats(workspaceId);
    if (!this.policy.canAddMember(plan, current)) {
      throw new LimitReachedException({ feature: 'members', current, limit: PLAN_LIMITS[plan].members as number, plan });
    }
  }

  public async assertCanOwnWorkspace(userId: string): Promise<void> {
    const plans = await this.subs.findPlansByOwner(userId);
    const plan = this.policy.highestPlan(plans.length > 0 ? plans : ['FREE']);
    const current = await this.repo.countOwnedWorkspaces(userId);
    if (!this.policy.canOwnWorkspace(plan, current)) {
      throw new LimitReachedException({ feature: 'ownedWorkspaces', current, limit: PLAN_LIMITS[plan].ownedWorkspaces as number, plan });
    }
  }

  public async requireFeature(workspaceId: string, feature: BillingFeature): Promise<void> {
    const plan = await this.planOf(workspaceId);
    if (!this.policy.hasFeature(plan, feature)) {
      throw new FeatureRequiredException({ feature, plan });
    }
  }

  public async requireWorkspaceRole(
    workspaceId: string,
    userId: string,
    minRole: WorkspaceRole,
  ): Promise<void> {
    const role = await this.repo.findActiveMemberRole(workspaceId, userId);
    if (!role || WORKSPACE_ROLE_RANK[role] < WORKSPACE_ROLE_RANK[minRole]) {
      throw new BillingException(BillingErrorCode.FORBIDDEN, 'Insufficient workspace role.', 403);
    }
  }

  public async countActiveSeats(workspaceId: string): Promise<number> {
    return this.repo.countActiveSeats(workspaceId);
  }

  public async findOwnerId(workspaceId: string): Promise<string | undefined> {
    return this.repo.findOwnerId(workspaceId);
  }

  private async planOf(workspaceId: string): Promise<BillingPlan> {
    const row = await this.subs.findByWorkspace(workspaceId);
    return row?.plan ?? 'FREE';
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter api test`
Expected: PASS.

- [ ] **Step 5: Create the global BillingModule (minimal)**

Create `apps/api/src/modules/billing/billing.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { BillingRepository } from './data/billing.repository';
import { UsageRepository } from './data/usage.repository';
import { StripeWebhookEventsRepository } from './data/stripe-webhook-events.repository';
import { BillingPolicy } from './policies/billing.policy';
import { UsageService } from './services/usage.service';

@Global()
@Module({
  imports: [AuditModule],
  providers: [
    BillingRepository,
    UsageRepository,
    StripeWebhookEventsRepository,
    BillingPolicy,
    UsageService,
  ],
  exports: [UsageService, BillingRepository, StripeWebhookEventsRepository, BillingPolicy],
})
export class BillingModule {}
```

In `apps/api/src/app.module.ts`, add `import { BillingModule } from './modules/billing/billing.module.js';` and add `BillingModule` to the `imports` array (after `AdminModule`).

- [ ] **Step 6: Enforce in boards.service (write failing tests first)**

In `apps/api/src/modules/boards/services/boards.service.ts`:
- Add `import { UsageService } from '../../billing/services/usage.service';` (from `modules/boards/services` → `modules/billing/services`)
- Add to the constructor: `@Inject(UsageService) private readonly usage: UsageService`,
- After `await this.requireRole(workspaceId, userId, 'EDITOR');` in BOTH the template `create` (line ~44) and the regular `create` (line ~86), insert: `await this.usage.assertCanCreateBoard(workspaceId);`

Write the failing tests in the EXISTING `apps/api/src/modules/boards/services/boards.service.spec.ts` (it already wires `BoardsService` via `Test.createTestingModule` with `db`/`boardsRepo`/`boardsPolicy`/`events` mocks and forwards `db.transaction` to the callback — see `mockDbSelect`, line 68):

- In the `providers` array (line 100) add: `{ provide: UsageService, useValue: usage }`.
- Add `let usage: { assertCanCreateBoard: jest.Mock };` near the other mocks and `usage = { assertCanCreateBoard: jest.fn() };` in `beforeEach`.
- Add the two tests to the `describe` block:

```ts
it('enforces the board limit before creating', async () => {
  usage.assertCanCreateBoard.mockRejectedValue(
    new Error('BILLING.LIMIT_REACHED'),
  );
  await expect(
    service.create('ws-1', 'u-1', { name: 'Blocked' }),
  ).rejects.toThrow('BILLING.LIMIT_REACHED');
  expect(usage.assertCanCreateBoard).toHaveBeenCalledWith('ws-1');
});

it('passes through when the plan allows another board', async () => {
  usage.assertCanCreateBoard.mockResolvedValue(undefined);
  boardsRepo.listByWorkspace.mockResolvedValue([]);
  boardsRepo.create.mockResolvedValue(mockBoard);
  columnsRepo.create.mockResolvedValue(mockColumn);
  await expect(
    service.create('ws-1', 'u-1', { name: 'Allowed' }),
  ).resolves.toEqual(mockBoard);
  expect(usage.assertCanCreateBoard).toHaveBeenCalledWith('ws-1');
});
```

`service.create('ws-1', 'u-1', { name })` is the regular non-template create; the enforcement call inside `createFromTemplate` is covered transitively by the same `usage` mock (assert it too if you like).

- [ ] **Step 7: Run board tests + implement**

Run: `pnpm --filter api test`
Expected: FAIL (assert not called / no inline error) → then make the code change above and re-run until PASS.

- [ ] **Step 8: Enforce in workspaces.service (write failing tests first)**

In `apps/api/src/modules/workspaces/services/workspaces.service.ts`:
- Add `import { BillingRepository } from '../..?...billing/data/billing.repository';` — exact path from `modules/workspaces` to `modules/billing`: `../../billing/data/billing.repository`.
- Add `import { UsageService } from '../../billing/services/usage.service';`
- Constructor: add `@Inject(UsageService) private readonly usage: UsageService,` and `@Inject(BillingRepository) private readonly billingSubs: BillingRepository,`
- `create()` (line ~115): after the slug-taken check add `await this.usage.assertCanOwnWorkspace(userId);`; inside the transaction after the member insert add `await this.billingSubs.createFree(ws.id, tx);`
- `transferOwnership()` (line ~53): after the `requireRole(workspaceId, currentOwnerId, 'OWNER')` call (and after the new-owner membership check) add `await this.usage.assertCanOwnWorkspace(newOwnerId);`
- `createInvitation()` (line ~355): right after `await this.requireRole(workspaceId, invitedByUserId, 'ADMIN');` add `await this.usage.assertCanAddMember(workspaceId);`

Add to `apps/api/src/modules/workspaces/services/workspaces.service.spec.ts` (extend the existing file if present, otherwise create it mirroring the existing module-test harness with `Test.createTestingModule`):

```ts
// Inside a describe('plan enforcement'):
it('create() throws when the user may not own another workspace on FREE', async () => {
  usage.assertCanOwnWorkspace.mockRejectedValue(new Error('BILLING.LIMIT_REACHED'));
  await expect(
    service.create('u-1', { name: 'New', slug: 'new-space' }),
  ).rejects.toThrow('BILLING.LIMIT_REACHED');
});

it('transferOwnership() throws when the new owner is over the FREE owned limit', async () => {
  usage.assertCanOwnWorkspace.mockRejectedValue(new Error('BILLING.LIMIT_REACHED'));
  await expect(
    service.transferOwnership('ws-1', 'owner-1', 'someone-else'),
  ).rejects.toThrow('BILLING.LIMIT_REACHED');
});

it('createInvitation() throws when the workspace is at the FREE member limit', async () => {
  usage.assertCanAddMember.mockRejectedValue(new Error('BILLING.LIMIT_REACHED'));
  await expect(
    service.createInvitation('ws-1', 'admin-1', { email: 'x@y.z', role: 'VIEWER' }),
  ).rejects.toThrow('BILLING.LIMIT_REACHED');
});
```

Wire the mocks into the harness: `usage = { assertCanOwnWorkspace: jest.fn(), assertCanAddMember: jest.fn() }`, `billingSubs = { createFree: jest.fn() }`, and provide both as `{ provide: UsageService, useValue: usage }` / `{ provide: BillingRepository, useValue: billingSubs }` in the testing module.

- [ ] **Step 9: Run + implement + verify**

Run: `pnpm --filter api test`
Expected: fail → implement the three call sites → PASS.

- [ ] **Step 10: Full api suite + commit**

Run: `pnpm --filter api test && pnpm --filter api build && pnpm --filter api lint`
Expected: PASS (lint baseline still only the 25 known warnings).

```bash
git add apps/api/src/modules/billing apps/api/src/modules/boards apps/api/src/modules/workspaces apps/api/src/app.module.ts
git commit -m "feat(billing): enforce plan limits at workspace and board mutation points"
```

---

### Task 6: Stripe environment configuration + boot-time pairing check

**Files:**
- Modify: `apps/api/src/config/env.schema.ts`
- Modify: `apps/api/src/config/configuration.ts`
- Modify: `.env.example`
- Test: Create `apps/api/src/config/env.schema.spec.ts` (folded-in check #3)

**Interfaces:**
- Consumes: existing `envSchema` + `superRefine` pattern (S3 optional-unless example).
- Produces: `billing` config namespace `{ stripeSecretKey, stripeWebhookSecret, priceProMonthly, priceTeamMonthly }` readable via `configService.get<string>('billing.stripeSecretKey')` etc.

- [ ] **Step 1: Write the failing env-schema tests**

Create `apps/api/src/config/env.schema.spec.ts`:

```ts
import { envSchema, envSchemaWithRefinements } from './env.schema';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://workspace:workspace123@localhost:5433/workspace',
  JWT_ACCESS_SECRET: '0123456789abcdef',
  JWT_REFRESH_SECRET: '0123456789abcdef0123456789abc',
};

describe('env schema billing', () => {
  it('accepts a fully-configured Stripe environment', () => {
    const res = envSchemaWithRefinements.safeParse({
      ...base,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro',
      STRIPE_PRICE_TEAM_MONTHLY: 'price_team',
    });
    expect(res.success).toBe(true);
  });

  it('accepts a Stripe-free environment (billing is optional)', () => {
    const res = envSchemaWithRefinements.safeParse(base);
    expect(res.success).toBe(true);
  });

  it('REJECTS a secret key without a webhook secret at boot', () => {
    const res = envSchemaWithRefinements.safeParse({ ...base, STRIPE_SECRET_KEY: 'sk_test_123' });
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL — the third test: no pairing rule exists yet, so a bare `STRIPE_SECRET_KEY` parses successfully.

- [ ] **Step 3: Add the env fields**

In `apps/api/src/config/env.schema.ts`, after the `MAIL_FROM` line, add:

```ts
  // Stripe billing (Phase 3). All optional at boot — billing simply stays
  // "not configured" — EXCEPT the pair rule enforced in the superRefine
  // below: a secret key must ship with a webhook secret, or signature
  // verification can never work.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_TEAM_MONTHLY: z.string().optional(),
```

- [ ] **Step 4: Add the boot-time pairing rule**

In `apps/api/src/config/env.schema.ts`, inside the existing `envSchemaWithRefinements = envSchema.superRefine(...)`, add after the S3 block (still inside the callback):

```ts
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
    ctx.addIssue({
      code: 'custom',
      path: ['STRIPE_WEBHOOK_SECRET'],
      message: 'STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set.',
    });
  }
```

- [ ] **Step 5: Run the env tests**

Run: `pnpm --filter api test`
Expected: PASS — all three new specs green.

- [ ] **Step 6: Add the configuration namespace**

In `apps/api/src/config/configuration.ts`, add a `billing` namespace inside the returned object (after `storage`):

```ts
    billing: {
      stripeSecretKey: env.STRIPE_SECRET_KEY,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      priceProMonthly: env.STRIPE_PRICE_PRO_MONTHLY,
      priceTeamMonthly: env.STRIPE_PRICE_TEAM_MONTHLY,
    },
```

- [ ] **Step 7: Document in .env.example**

Append to `.env.example`:

```
# Stripe billing (Phase 3) — all optional. Billing stays "not configured" when
# absent. STRIPE_WEBHOOK_SECRET is REQUIRED once STRIPE_SECRET_KEY is set
# (validated at boot). Price IDs come from the Stripe dashboard.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_TEAM_MONTHLY=
```

- [ ] **Step 8: Verify and commit**

Run: `pnpm --filter api build && pnpm --filter api test`
Expected: PASS.

```bash
git add apps/api/src/config .env.example
git commit -m "feat(billing): add stripe env config with webhook-secret pairing check"
```

---

### Task 7: StripeService, BillingService, controllers, webhook, module wiring

**Files:**
- Create: `apps/api/src/modules/billing/services/stripe.service.ts`
- Create: `apps/api/src/modules/billing/services/billing.service.ts`
- Create: `apps/api/src/modules/billing/dto/checkout.dto.ts`
- Create: `apps/api/src/modules/billing/dto/portal.dto.ts`
- Create: `apps/api/src/modules/billing/controllers/billing.controller.ts`
- Create: `apps/api/src/modules/billing/controllers/workspace-subscription.controller.ts`
- Test: `apps/api/src/modules/billing/controllers/billing.controller.spec.ts`
- Test: `apps/api/src/modules/billing/services/billing.service.spec.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts` (add services + controllers)
- Modify: `apps/api/src/main.ts` (enable `rawBody`)
- Modify: `apps/api/package.json` (add `stripe` dependency)

**Interfaces:**
- Consumes: `BillingRepository`, `UsageService` (Tasks 4-5), `StripeWebhookEventsRepository`, `AuditService` (exported from `AuditModule`), `BillingPolicy`/constants.
- Produces:
  - `StripeService.createCheckoutSession(params)`, `createPortalSession(params)`, `constructEvent(rawBody, signature)`, `getPriceId(plan)`
  - `BillingService.checkout(workspaceId, userId, email, plan): Promise<{ url: string }>`
  - `BillingService.portal(workspaceId, userId): Promise<{ url: string }>`
  - `BillingService.handleWebhook(rawBody, signature): Promise<{ received: true }>`
  - HTTP: `POST /api/v1/billing/checkout`, `POST /api/v1/billing/portal`, `POST /api/v1/billing/webhook` (public), `GET /api/v1/workspaces/:workspaceId/subscription`

- [ ] **Step 1: Write the failing BillingController tests**

Create `apps/api/src/modules/billing/controllers/billing.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';

import { BillingException, BillingErrorCode } from '../errors/billing.errors';
import { BillingService } from '../services/billing.service';
import { BillingController } from './billing.controller';
import { WorkspaceSubscriptionController } from './workspace-subscription.controller';
import { UsageService } from '../services/usage.service';

describe('BillingController', () => {
  let controller: BillingController;
  let billing: { checkout: jest.Mock; portal: jest.Mock; handleWebhook: jest.Mock };

  beforeEach(async () => {
    billing = { checkout: jest.fn(), portal: jest.fn(), handleWebhook: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: billing }],
    }).compile();
    controller = module.get(BillingController);
  });

  const user = { id: 'u-1', email: 'a@b.com' } as never;

  it('POST /billing/checkout delegates to billing.checkout and returns the URL', async () => {
    billing.checkout.mockResolvedValue({ url: 'https://checkout.stripe.com/xyz' });
    const res = await controller.checkout(user, { workspaceId: 'ws-1', plan: 'PRO' });
    expect(billing.checkout).toHaveBeenCalledWith('ws-1', 'u-1', 'a@b.com', 'PRO');
    expect(res).toEqual({ url: 'https://checkout.stripe.com/xyz' });
  });

  it('POST /billing/portal delegates to billing.portal', async () => {
    billing.portal.mockResolvedValue({ url: 'https://billing.stripe.com/p/xyz' });
    const res = await controller.portal(user, { workspaceId: 'ws-1' });
    expect(billing.portal).toHaveBeenCalledWith('ws-1', 'u-1');
    expect(res).toEqual({ url: 'https://billing.stripe.com/p/xyz' });
  });

  it('POST /billing/webhook rejects a missing signature', async () => {
    await expect(controller.webhook({ headers: {}, rawBody: Buffer.from('{}') } as never)).rejects.toMatchObject({
      code: 'BILLING.WEBHOOK_INVALID',
    });
  });

  it('POST /billing/webhook forwards raw body + signature and returns received', async () => {
    billing.handleWebhook.mockResolvedValue({ received: true });
    const req = { headers: { 'stripe-signature': 'sig123' }, rawBody: Buffer.from('{"k":1}') };
    const res = await controller.webhook(req as never);
    expect(billing.handleWebhook).toHaveBeenCalledWith(Buffer.from('{"k":1}'), 'sig123');
    expect(res).toEqual({ received: true });
  });
});

describe('WorkspaceSubscriptionController', () => {
  let controller: WorkspaceSubscriptionController;
  let usage: { getSubscriptionView: jest.Mock };

  beforeEach(async () => {
    usage = { getSubscriptionView: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [WorkspaceSubscriptionController],
      providers: [{ provide: UsageService, useValue: usage }],
    }).compile();
    controller = module.get(WorkspaceSubscriptionController);
  });

  it('GET /workspaces/:workspaceId/subscription returns the view', async () => {
    usage.getSubscriptionView.mockResolvedValue({ workspaceId: 'ws-1', plan: 'PRO', status: 'ACTIVE', currentPeriodEnd: null });
    const res = await controller.getSubscription('ws-1');
    expect(usage.getSubscriptionView).toHaveBeenCalledWith('ws-1');
    expect(res.plan).toBe('PRO');
  });
});
```

- [ ] **Step 2: Run to verify it fails + add the stripe dependency**

Run: `pnpm --filter api test` — expected FAIL (module files don't exist).

Install the SDK: `pnpm --filter api add stripe`
Expected: `stripe` appears in `apps/api/package.json`.

- [ ] **Step 3: Write the failing BillingService tests**

Create `apps/api/src/modules/billing/services/billing.service.spec.ts`:

```ts
import { BillingRepository } from '../data/billing.repository';
import { StripeWebhookEventsRepository } from '../data/stripe-webhook-events.repository';
import { UsageService } from './usage.service';
import { StripeService } from './stripe.service';
import { AuditService } from '../../audit/services/audit.service';
import { BillingService } from './billing.service';
import { BillingErrorCode } from '../errors/billing.errors';

describe('BillingService', () => {
  let usage: { requireWorkspaceRole: jest.Mock; countActiveSeats: jest.Mock; findOwnerId: jest.Mock };
  let stripe: { getPriceId: jest.Mock; createCheckoutSession: jest.Mock; createPortalSession: jest.Mock; constructEvent: jest.Mock };
  let subs: { findByWorkspace: jest.Mock; findByStripeSubscription: jest.Mock; upsertFromStripe: jest.Mock; updateStripeData: jest.Mock };
  let events: { findById: jest.Mock; create: jest.Mock; setStatus: jest.Mock };
  let audit: { record: jest.Mock };
  let config: { get: jest.Mock };
  let service: BillingService;

  beforeEach(() => {
    usage = { requireWorkspaceRole: jest.fn(), countActiveSeats: jest.fn(), findOwnerId: jest.fn() };
    stripe = { getPriceId: jest.fn(), createCheckoutSession: jest.fn(), createPortalSession: jest.fn(), constructEvent: jest.fn() };
    subs = { findByWorkspace: jest.fn(), findByStripeSubscription: jest.fn(), upsertFromStripe: jest.fn(), updateStripeData: jest.fn() };
    events = { findById: jest.fn(), create: jest.fn(), setStatus: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('http://localhost:3000') };
    service = new BillingService(
      usage as unknown as UsageService,
      stripe as unknown as StripeService,
      subs as unknown as BillingRepository,
      events as unknown as StripeWebhookEventsRepository,
      audit as unknown as AuditService,
      config as unknown as never,
    );
  });

  describe('checkout', () => {
    it('requires ADMIN role and passes the seat count as quantity', async () => {
      usage.requireWorkspaceRole.mockResolvedValue(undefined);
      usage.countActiveSeats.mockResolvedValue(2);
      stripe.getPriceId.mockReturnValue('price_pro');
      stripe.createCheckoutSession.mockResolvedValue({ url: 'https://c' });
      const res = await service.checkout('ws-1', 'u-1', 'a@b.com', 'PRO');
      expect(usage.requireWorkspaceRole).toHaveBeenCalledWith('ws-1', 'u-1', 'ADMIN');
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ priceId: 'price_pro', quantity: 2, customerEmail: 'a@b.com', workspaceId: 'ws-1', plan: 'PRO' }),
      );
      expect(res).toEqual({ url: 'https://c' });
    });

    it('rejects an unknown plan with PLAN_NOT_FOUND', async () => {
      await expect(service.checkout('ws-1', 'u-1', 'a@b.com', 'FREE' as never)).rejects.toMatchObject({ code: BillingErrorCode.PLAN_NOT_FOUND });
    });

    it('never lets quantity drop below 1', async () => {
      usage.requireWorkspaceRole.mockResolvedValue(undefined);
      usage.countActiveSeats.mockResolvedValue(0);
      stripe.getPriceId.mockReturnValue('price_team');
      stripe.createCheckoutSession.mockResolvedValue({ url: 'https://c' });
      await service.checkout('ws-1', 'u-1', 'a@b.com', 'TEAM');
      expect(stripe.createCheckoutSession.mock.calls[0][0].quantity).toBe(1);
    });
  });

  describe('portal', () => {
    it('requires a linked customer, else NO_CUSTOMER', async () => {
      usage.requireWorkspaceRole.mockResolvedValue(undefined);
      subs.findByWorkspace.mockResolvedValue({ stripeCustomerId: null } as never);
      await expect(service.portal('ws-1', 'u-1')).rejects.toMatchObject({ code: BillingErrorCode.NO_CUSTOMER });
    });
    it('creates a portal session for the linked customer', async () => {
      usage.requireWorkspaceRole.mockResolvedValue(undefined);
      subs.findByWorkspace.mockResolvedValue({ stripeCustomerId: 'cus_1' } as never);
      stripe.createPortalSession.mockResolvedValue({ url: 'https://b' });
      const res = await service.portal('ws-1', 'u-1');
      expect(stripe.createPortalSession).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_1' }));
      expect(res).toEqual({ url: 'https://b' });
    });
  });

  describe('handleWebhook (idempotency)', () => {
    it('returns received immediately for an already-completed event', async () => {
      events.findById.mockResolvedValue({ id: 'evt_1', status: 'COMPLETED' } as never);
      const res = await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(events.create).not.toHaveBeenCalled();
      expect(res).toEqual({ received: true });
    });

    it('processes a new checkout.session.completed and audits the change', async () => {
      events.findById.mockResolvedValue(undefined);
      events.create.mockResolvedValue({ id: 'evt_1' } as never);
      usage.findOwnerId.mockResolvedValue('owner-1');
      subs.upsertFromStripe.mockResolvedValue({} as never);
      stripe.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { workspaceId: 'ws-1', plan: 'PRO' },
            customer: 'cus_1',
            subscription: 'sub_1',
            status: 'complete',
          },
        },
      });
      const res = await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(subs.upsertFromStripe).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', plan: 'PRO', status: 'ACTIVE', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.subscription_changed', workspaceId: 'ws-1', userId: 'owner-1' }),
      );
      expect(events.setStatus).toHaveBeenCalledWith('evt_1', 'COMPLETED');
      expect(res).toEqual({ received: true });
    });

    it('marks FAILED and rethrows when applying the event fails', async () => {
      events.findById.mockResolvedValue(undefined);
      events.create.mockResolvedValue({ id: 'evt_1' } as never);
      const boom = new Error('apply failed');
      stripe.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: { metadata: { workspaceId: 'ws-1', plan: 'PRO' } } },
      });
      subs.upsertFromStripe.mockRejectedValue(boom);
      await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toBe(boom);
      expect(events.setStatus).toHaveBeenCalledWith('evt_1', 'FAILED');
    });

    it('downgrades to FREE on subscription.canceled', async () => {
      events.findById.mockResolvedValue(undefined);
      events.create.mockResolvedValue({ id: 'evt_2' } as never);
      usage.findOwnerId.mockResolvedValue('owner-1');
      subs.findByStripeSubscription.mockResolvedValue({ id: 'row-1', workspaceId: 'ws-1', plan: 'PRO' } as never);
      subs.updateStripeData.mockResolvedValue({} as never);
      stripe.constructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_1', status: 'canceled', current_period_start: 1700000000, current_period_end: 1702592000, canceled_at: 1700100000 } },
      });
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(subs.updateStripeData).toHaveBeenCalledWith(
        'row-1',
        expect.objectContaining({ status: 'CANCELED', plan: 'FREE' }),
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ plan: 'FREE', status: 'CANCELED' }) }));
    });
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL — `./stripe.service`, `./billing.service` and the DTOs/controllers don't exist.

- [ ] **Step 5: Implement StripeService**

Create `apps/api/src/modules/billing/services/stripe.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { BillingErrorCode, BillingException } from '../errors/billing.errors';
import { type PricedPlan } from '../billing.constants';

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private client(): Stripe {
    if (this.stripe) return this.stripe;
    const secretKey = this.config.get<string>('billing.stripeSecretKey');
    if (!secretKey) {
      throw new BillingException(BillingErrorCode.NOT_CONFIGURED, 'Stripe is not configured.', 503);
    }
    this.stripe = new Stripe(secretKey);
    return this.stripe;
  }

  public getPriceId(plan: PricedPlan): string {
    const key = plan === 'PRO' ? 'billing.priceProMonthly' : 'billing.priceTeamMonthly';
    const priceId = this.config.get<string>(key);
    if (!priceId) {
      throw new BillingException(BillingErrorCode.NOT_CONFIGURED, `Missing Stripe price ID for ${plan}.`, 503);
    }
    return priceId;
  }

  public async createCheckoutSession(params: {
    priceId: string;
    quantity: number;
    customerEmail: string;
    workspaceId: string;
    plan: PricedPlan;
    publicBaseUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    return this.client().checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.customerEmail,
      line_items: [{ price: params.priceId, quantity: params.quantity }],
      metadata: { workspaceId: params.workspaceId, plan: params.plan },
      subscription_data: { metadata: { workspaceId: params.workspaceId } },
      success_url: `${params.publicBaseUrl}/workspaces/${params.workspaceId}?billing=success`,
      cancel_url: `${params.publicBaseUrl}/workspaces/${params.workspaceId}?billing=canceled`,
    });
  }

  public async createPortalSession(params: {
    customer: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    return this.client().billingPortal.sessions.create({
      customer: params.customer,
      return_url: params.returnUrl,
    });
  }

  public constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>('billing.stripeWebhookSecret');
    if (!webhookSecret) {
      throw new BillingException(BillingErrorCode.NOT_CONFIGURED, 'Stripe is not configured.', 503);
    }
    return this.client().webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
```

- [ ] **Step 6: Implement BillingService**

Create `apps/api/src/modules/billing/services/billing.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import type { AuditEventRow, SubscriptionPlan } from '@repo/database';

import { AuditService } from '../../audit/services/audit.service';
import { BillingRepository } from '../data/billing.repository';
import { StripeWebhookEventsRepository } from '../data/stripe-webhook-events.repository';
import { BillingErrorCode, BillingException } from '../errors/billing.errors';
import { isPricedPlan, PRICED_PLANS, type PricedPlan } from '../billing.constants';
import { StripeService } from './stripe.service';
import { UsageService } from './usage.service';

@Injectable()
export class BillingService {
  constructor(
    @Inject(UsageService) private readonly usage: UsageService,
    @Inject(StripeService) private readonly stripe: StripeService,
    @Inject(BillingRepository) private readonly subs: BillingRepository,
    @Inject(StripeWebhookEventsRepository) private readonly events: StripeWebhookEventsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  public async checkout(
    workspaceId: string,
    userId: string,
    customerEmail: string,
    plan: PricedPlan,
  ): Promise<{ url: string }> {
    if (!isPricedPlan(plan)) {
      throw new BillingException(BillingErrorCode.PLAN_NOT_FOUND, 'Unknown plan.', 400);
    }
    await this.usage.requireWorkspaceRole(workspaceId, userId, 'ADMIN');
    const priceId = this.stripe.getPriceId(plan);
    const seats = Math.max(1, await this.usage.countActiveSeats(workspaceId));
    const publicBaseUrl = this.config.get<string>('app.publicBaseUrl') ?? 'http://localhost:3000';
    const session = await this.stripe.createCheckoutSession({
      priceId,
      quantity: seats,
      customerEmail,
      workspaceId,
      plan,
      publicBaseUrl,
    });
    if (!session.url) {
      throw new BillingException(BillingErrorCode.NOT_CONFIGURED, 'Stripe did not return a checkout URL.', 503);
    }
    return { url: session.url };
  }

  public async portal(workspaceId: string, userId: string): Promise<{ url: string }> {
    await this.usage.requireWorkspaceRole(workspaceId, userId, 'ADMIN');
    const sub = await this.subs.findByWorkspace(workspaceId);
    if (!sub?.stripeCustomerId) {
      throw new BillingException(BillingErrorCode.NO_CUSTOMER, 'No Stripe customer is linked to this workspace yet.', 409);
    }
    const publicBaseUrl = this.config.get<string>('app.publicBaseUrl') ?? 'http://localhost:3000';
    const session = await this.stripe.createPortalSession({
      customer: sub.stripeCustomerId,
      returnUrl: `${publicBaseUrl}/workspaces/${workspaceId}?billing=manage`,
    });
    return { url: session.url };
  }

  public async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const event = this.stripe.constructEvent(rawBody, signature);

    const existing = await this.events.findById(event.id);
    if (existing?.status === 'COMPLETED') return { received: true };

    if (!existing) {
      await this.events.create({
        id: event.id,
        type: event.type,
        payload: (event.data.object as Record<string, unknown>) ?? {},
        status: 'PROCESSING',
      });
    }

    try {
      await this.applyEvent(event);
      await this.events.setStatus(event.id, 'COMPLETED');
    } catch (err) {
      await this.events.setStatus(event.id, 'FAILED').catch(() => {});
      throw err;
    }
    return { received: true };
  }

  private async applyEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        return;
      case 'customer.subscription.updated':
        await this.handleSubscriptionChanged(event.data.object as Stripe.Subscription);
        return;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        return;
      default:
        return;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const workspaceId = session.metadata?.workspaceId;
    const plan = session.metadata?.plan;
    if (!workspaceId || !isPricedPlan(plan)) return; // unrelated/legacy event — skip silently

    await this.subs.upsertFromStripe({
      workspaceId,
      plan,
      status: 'ACTIVE',
      stripeCustomerId: session.customer ? String(session.customer) : null,
      stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });

    await this.recordChange(workspaceId, plan, 'ACTIVE', eventTypeToLabel('checkout.session.completed'));
  }

  private async handleSubscriptionChanged(sub: Stripe.Subscription): Promise<void> {
    const row = await this.subs.findByStripeSubscription(sub.id);
    if (!row) return;

    const canceled = sub.status === 'canceled';
    const status = mapSubscriptionStatus(sub.status);
    const plan: SubscriptionPlan = canceled ? 'FREE' : row.plan;

    await this.subs.updateStripeData(row.id, {
      status,
      plan,
      // design §5: a canceled subscription clears the period window
      currentPeriodStart: sub.status === 'canceled' ? null : sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
      currentPeriodEnd: sub.status === 'canceled' ? null : sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    });

    await this.recordChange(row.workspaceId, plan, status, eventTypeToLabel('customer.subscription.updated'));
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const row = await this.subs.findByStripeSubscription(sub.id);
    if (!row) return;

    await this.subs.updateStripeData(row.id, {
      status: 'CANCELED',
      plan: 'FREE',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      canceledAt: new Date(),
    });

    await this.recordChange(row.workspaceId, 'FREE', 'CANCELED', eventTypeToLabel('customer.subscription.deleted'));
  }

  private async recordChange(
    workspaceId: string,
    plan: SubscriptionPlan,
    status: string,
    source: string,
  ): Promise<void> {
    const userId = await this.usage.findOwnerId(workspaceId);
    if (!userId) return;
    await this.audit.record({
      workspaceId,
      userId,
      action: 'billing.subscription_changed',
      resourceType: 'subscription',
      resourceId: workspaceId,
      metadata: { plan, status, source },
    });
  }
}

function eventTypeToLabel(type: string): string {
  switch (type) {
    case 'checkout.session.completed':
      return 'checkout.session.completed';
    case 'customer.subscription.updated':
      return 'customer.subscription.updated';
    case 'customer.subscription.deleted':
      return 'customer.subscription.deleted';
    default:
      return type;
  }
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING' | 'INCOMPLETE' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'unpaid':
      return 'UNPAID';
    case 'trialing':
      return 'TRIALING';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    default:
      return 'INCOMPLETE';
  }
}
```

- [ ] **Step 7: Create the DTOs**

Create `apps/api/src/modules/billing/dto/checkout.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

import { PRICED_PLANS, type PricedPlan } from '../billing.constants';

export class CheckoutDto {
  @ApiProperty({ example: '1a2b3c4d-5e6f-4a5b-6c7d-8e9f0a1b2c3d' })
  @IsUUID()
  workspaceId!: string;

  @ApiProperty({ enum: PRICED_PLANS })
  @IsIn(['PRO', 'TEAM'])
  plan!: PricedPlan;
}
```

Create `apps/api/src/modules/billing/dto/portal.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PortalDto {
  @ApiProperty()
  @IsUUID()
  workspaceId!: string;
}
```

- [ ] **Step 8: Create the controllers**

Create `apps/api/src/modules/billing/controllers/billing.controller.ts`:

```ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';
import { CheckoutDto } from '../dto/checkout.dto';
import { PortalDto } from '../dto/portal.dto';
import { BillingErrorCode, BillingException } from '../errors/billing.errors';
import { BillingService } from '../services/billing.service';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Stripe Checkout session to upgrade a workspace' })
  public async checkout(
    @CurrentUser() user: CurrentUserModel,
    @Body() body: CheckoutDto,
  ): Promise<{ url: string }> {
    return this.billing.checkout(body.workspaceId, user.id, user.email, body.plan);
  }

  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open the Stripe billing portal for a workspace' })
  public async portal(
    @CurrentUser() user: CurrentUserModel,
    @Body() body: PortalDto,
  ): Promise<{ url: string }> {
    return this.billing.portal(body.workspaceId, user.id);
  }

  @Public()
  @Throttle({ default: { limit: 1000, ttl: 60_000 } })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver (signature-verified)' })
  public async webhook(@Req() req: Request): Promise<{ received: true }> {
    const signature =
      typeof req.headers['stripe-signature'] === 'string'
        ? req.headers['stripe-signature']
        : undefined;
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody || !signature) {
      throw new BillingException(
        BillingErrorCode.WEBHOOK_INVALID,
        'Missing webhook body or stripe-signature header.',
        400,
      );
    }
    return this.billing.handleWebhook(rawBody, signature);
  }
}
```

Create `apps/api/src/modules/billing/controllers/workspace-subscription.controller.ts`:

```ts
import { Controller, Get, HttpCode, HttpStatus, Inject, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';
import { type SubscriptionView, UsageService } from '../services/usage.service';

@ApiTags('Billing')
@ApiBearerAuth()
@WorkspaceAccess('VIEWER', { param: 'workspaceId' })
@Controller({ path: 'workspaces/:workspaceId/subscription', version: '1' })
export class WorkspaceSubscriptionController {
  constructor(@Inject(UsageService) private readonly usage: UsageService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a workspace subscription plan and status' })
  public async getSubscription(@Param('workspaceId') workspaceId: string): Promise<SubscriptionView> {
    return this.usage.getSubscriptionView(workspaceId);
  }
}
```

- [ ] **Step 9: Finish the module + enable raw body**

In `apps/api/src/modules/billing/billing.module.ts`, extend providers to add `StripeService` and `BillingService`, and add the controllers:

```ts
import { Global, Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { BillingController } from './controllers/billing.controller';
import { WorkspaceSubscriptionController } from './controllers/workspace-subscription.controller';
import { BillingRepository } from './data/billing.repository';
import { StripeWebhookEventsRepository } from './data/stripe-webhook-events.repository';
import { UsageRepository } from './data/usage.repository';
import { BillingPolicy } from './policies/billing.policy';
import { BillingService } from './services/billing.service';
import { StripeService } from './services/stripe.service';
import { UsageService } from './services/usage.service';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [BillingController, WorkspaceSubscriptionController],
  providers: [
    BillingRepository,
    StripeWebhookEventsRepository,
    UsageRepository,
    BillingPolicy,
    UsageService,
    StripeService,
    BillingService,
  ],
  exports: [UsageService, BillingRepository, StripeWebhookEventsRepository, BillingPolicy, StripeService, BillingService],
})
export class BillingModule {}
```

Wait — `AuditModule` (imported by `BillingModule`) already imports `WorkspacesModule`, and `WorkspacesModule` now injects `UsageService`. Because `BillingModule` is `@Global()` and NOT imported by `WorkspacesModule`/`BoardsModule`, there is no import cycle; Nest resolves `UsageService` through the global registry. Do NOT import `BillingModule` in `WorkspacesModule`/`BoardsModule`.

In `apps/api/src/main.ts`, change the `NestFactory.create` options to:

```ts
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
```

Verify the installed Nest version supports `rawBody` (≥ 9.3; if the `Request` type does not expose `rawBody`, cast as shown in the controller — already handled).

- [ ] **Step 10: Run the api tests + build**

Run: `pnpm --filter api test && pnpm --filter api build`
Expected: PASS — controller and service specs green (Stripe is mocked via the `stripe` object; no real keys needed).

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/modules/billing apps/api/src/main.ts apps/api/package.json apps/api/pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "feat(billing): add stripe checkout, portal, and idempotent webhook handling"
```

---

### Task 8: Admin live plan lookup (replace the stub)

**Files:**
- Modify: `apps/api/src/modules/admin/controllers/admin.controller.ts` (swap route)
- Modify: `apps/api/src/modules/admin/services/admin.service.ts` (remove `STUB_SUBSCRIPTION`)
- Modify: `apps/api/src/modules/admin/controllers/admin.controller.spec.ts`
- Modify: `apps/web/lib/admin.ts` (swap client method)
- Modify: `apps/web/app/admin/page.tsx` (call site passes workspace id already — update method)

**Interfaces:**
- Consumes: `BillingRepository` (global, Task 4).
- Produces: `GET /api/v1/admin/workspaces/:id/subscription` → `{ plan, status }`; removes `GET /api/v1/admin/users/:id/subscription`.

- [ ] **Step 1: Update the failing admin spec**

In `apps/api/src/modules/admin/controllers/admin.controller.spec.ts`:
- Add a `billingRepo` mock: `const billingRepo = { findByWorkspace: jest.fn() };`
- Provide it: `{ provide: BillingRepository, useValue: billingRepo }` (import `BillingRepository` from `../../billing/data/billing.repository`).
- Replace the stub test (`GET /users/:id/subscription returns the stub`, lines 67-71) with:

```ts
  it('GET /workspaces/:id/subscription returns the stored plan', async () => {
    billingRepo.findByWorkspace.mockResolvedValue({ plan: 'PRO', status: 'ACTIVE' });
    const res = await controller.getWorkspaceSubscription('ws-1');
    expect(billingRepo.findByWorkspace).toHaveBeenCalledWith('ws-1');
    expect(res).toEqual({ plan: 'PRO', status: 'ACTIVE' });
  });

  it('GET /workspaces/:id/subscription defaults to FREE when no row exists', async () => {
    billingRepo.findByWorkspace.mockResolvedValue(undefined);
    const res = await controller.getWorkspaceSubscription('legacy-1');
    expect(res).toEqual({ plan: 'FREE', status: 'ACTIVE' });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL — `controller.getWorkspaceSubscription` doesn't exist and `AdminService.STUB_SUBSCRIPTION` is referenced.

- [ ] **Step 3: Swap the admin route**

In `apps/api/src/modules/admin/controllers/admin.controller.ts`:
- Add `import { BillingRepository } from '../../billing/data/billing.repository';`
- Add to the constructor: `@Inject(BillingRepository) private readonly billingRepo: BillingRepository,`
- Remove the `getSubscription()` method and its `@Get('users/:id/subscription')` decorator + `@ApiOperation` block.
- Add:

```ts
  @Get('workspaces/:id/subscription')
  @ApiOperation({ summary: 'Get a workspace subscription plan and status' })
  public async getWorkspaceSubscription(@Param('id') id: string) {
    const sub = await this.billingRepo.findByWorkspace(id);
    return { plan: sub?.plan ?? 'FREE', status: sub?.status ?? 'ACTIVE' };
  }
```

In `apps/api/src/modules/admin/services/admin.service.ts`, remove the `STUB_SUBSCRIPTION` static property (line ~21).

- [ ] **Step 4: Run tests**

Run: `pnpm --filter api test && pnpm --filter api build`
Expected: PASS.

- [ ] **Step 5: Update the web client + sweep for orphaned calls (folded-in check #2)**

In `apps/web/lib/admin.ts`, replace the `getSubscription` method with:

```ts
  getWorkspaceSubscription: (workspaceId: string) =>
    api.get<{ plan: string; status: string }>(
      `/admin/workspaces/${workspaceId}/subscription`,
    ),
```

In `apps/web/app/admin/page.tsx`, `handleLoadSubscription` (line ~138) calls `adminApi.getSubscription(userId)` — change to `adminApi.getWorkspaceSubscription(userId)` (userId here is already the workspace id passed from the WorkspacesTab row). The state key is already `subscriptions[ws.id]`, so no other change is needed.

Sweep for orphaned references:

Run: `grep -rn "getSubscription\|users/:id/subscription\|users\${userId}/subscription" apps/web --include=*.ts --include=*.tsx`
Expected: ZERO matches (folded-in check #2 passes).

- [ ] **Step 6: Verify web + commit**

Run: `rm -rf apps/web/.next && pnpm --filter web check-types && pnpm --filter web build`
Expected: PASS.

```bash
git add apps/api/src/modules/admin apps/web/lib/admin.ts apps/web/app/admin
git commit -m "feat(admin): read live workspace subscription plan (remove stub)"
```

---

### Task 9: Team-only audit-log export

**Files:**
- Modify: `apps/api/src/modules/audit/repositories/audit.repository.ts` (add `listAllByWorkspace`)
- Modify: `apps/api/src/modules/audit/services/audit.service.ts` (add `exportWorkspace`)
- Create: `apps/api/src/modules/billing/utils/export-serializer.ts`
- Create: `apps/api/src/modules/billing/controllers/audit-export.controller.ts`
- Test: `apps/api/src/modules/billing/utils/export-serializer.spec.ts`
- Test: `apps/api/src/modules/billing/controllers/audit-export.controller.spec.ts`

**Interfaces:**
- Consumes: `AuditService` (exported from `AuditModule`), `UsageService.requireFeature`, `BILLING_FEATURES.AUDIT_LOG_EXPORT`.
- Produces: `AuditService.exportWorkspace(workspaceId): Promise<AuditEventRow[]>`; `buildExportPayload(rows, format)` pure serializer; `GET /api/v1/workspaces/:workspaceId/audit/export?format=json|csv`.

- [ ] **Step 1: Write the failing serializer test**

Create `apps/api/src/modules/billing/utils/export-serializer.spec.ts`:

```ts
import type { AuditEventRow } from '@repo/database';
import { buildExportPayload } from './export-serializer';

const row: AuditEventRow = {
  id: 'a1',
  workspaceId: 'ws-1',
  userId: 'u-1',
  action: 'board.created',
  resourceType: 'board',
  resourceId: 'b-1',
  metadata: { name: 'Plan, "Q3"', n: 1 },
  createdAt: new Date('2026-08-30T12:00:00.000Z'),
};

describe('buildExportPayload', () => {
  it('serializes JSON with ISO dates and an .json filename', () => {
    const out = buildExportPayload([row], 'json');
    expect(out.contentType).toBe('application/json');
    expect(out.fileName).toMatch(/\.json$/);
    const parsed = JSON.parse(out.data);
    expect(parsed[0]).toMatchObject({ id: 'a1', action: 'board.created', createdAt: '2026-08-30T12:00:00.000Z' });
  });

  it('serializes CSV with header row and escaped fields', () => {
    const out = buildExportPayload([row], 'csv');
    expect(out.contentType).toBe('text/csv');
    expect(out.fileName).toMatch(/\.csv$/);
    const lines = out.data.split('\n');
    expect(lines[0]).toBe('id,workspaceId,userId,action,resourceType,resourceId,metadata,createdAt');
    expect(lines[1]).toContain('"Plan, ""Q3""');
  });
});
```

- [ ] **Step 2: Write the failing controller test**

Create `apps/api/src/modules/billing/controllers/audit-export.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import type { AuditEventRow } from '@repo/database';

import { AuditService } from '../../audit/services/audit.service';
import { UsageService } from '../services/usage.service';
import { AuditExportController } from './audit-export.controller';

describe('AuditExportController', () => {
  let controller: AuditExportController;
  let usage: { requireFeature: jest.Mock };
  let audit: { exportWorkspace: jest.Mock };

  beforeEach(async () => {
    usage = { requireFeature: jest.fn() };
    audit = { exportWorkspace: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [AuditExportController],
      providers: [
        { provide: UsageService, useValue: usage },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    controller = module.get(AuditExportController);
  });

  it('gates the export behind AUDIT_LOG_EXPORT', async () => {
    usage.requireFeature.mockRejectedValue(new Error('BILLING.FEATURE_REQUIRED'));
    await expect(controller.exportAudit('ws-1', 'json')).rejects.toThrow('BILLING.FEATURE_REQUIRED');
    expect(usage.requireFeature).toHaveBeenCalledWith('ws-1', 'AUDIT_LOG_EXPORT');
  });

  it('returns a downloadable payload for TEAM workspaces', async () => {
    usage.requireFeature.mockResolvedValue(undefined);
    audit.exportWorkspace.mockResolvedValue([]);
    const res = await controller.exportAudit('ws-1', 'csv');
    expect(audit.exportWorkspace).toHaveBeenCalledWith('ws-1');
    expect(res).toMatchObject({ contentType: 'text/csv' });
    expect(res.fileName).toMatch(/\.csv$/);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL — `contentType`/`fileName`/`exportWorkspace`/controllers not yet present.

- [ ] **Step 4: Add the audit repository + service methods**

In `apps/api/src/modules/audit/repositories/audit.repository.ts`, add:

```ts
  public async listAllByWorkspace(workspaceId: string): Promise<AuditEventRow[]> {
    return this.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.workspaceId, workspaceId))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));
  }
```

In `apps/api/src/modules/audit/services/audit.service.ts`, add:

```ts
  public async exportWorkspace(workspaceId: string): Promise<AuditEventRow[]> {
    return this.repo.listAllByWorkspace(workspaceId);
  }
```

(Simplify the return type to `import type { AuditEventRow } from '@repo/database';` and use `Promise<AuditEventRow[]>` if the generic form reads awkwardly — it must match the controller's `rows` mapping.)

- [ ] **Step 5: Implement the serializer**

Create `apps/api/src/modules/billing/utils/export-serializer.ts`:

```ts
import type { AuditEventRow } from '@repo/database';

export type ExportFormat = 'json' | 'csv';

export type ExportPayload = {
  fileName: string;
  contentType: string;
  data: string;
};

function dateStamp(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildExportPayload(rows: AuditEventRow[], format: ExportFormat): ExportPayload {
  const stamp = dateStamp(new Date());
  if (format === 'csv') {
    const header = ['id', 'workspaceId', 'userId', 'action', 'resourceType', 'resourceId', 'metadata', 'createdAt'];
    const lines = rows.map((r) =>
      [
        csvField(r.id),
        csvField(r.workspaceId),
        csvField(r.userId),
        csvField(r.action),
        csvField(r.resourceType),
        csvField(r.resourceId),
        csvField(JSON.stringify(r.metadata ?? {})),
        csvField(r.createdAt.toISOString()),
      ].join(','),
    );
    return {
      fileName: `audit-${stamp}.csv`,
      contentType: 'text/csv',
      data: [header.join(','), ...lines].join('\n'),
    };
  }
  return {
    fileName: `audit-${stamp}.json`,
    contentType: 'application/json',
    data: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        userId: r.userId,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        metadata: r.metadata ?? {},
        createdAt: r.createdAt.toISOString(),
      })),
      null,
      2,
    ),
  };
}
```

- [ ] **Step 6: Implement the controller**

Create `apps/api/src/modules/billing/controllers/audit-export.controller.ts`:

```ts
import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { WorkspaceAccess } from '../../../common/decorators/workspace-access.decorator';
import { AuditService } from '../../audit/services/audit.service';
import { BILLING_FEATURES } from '../billing.constants';
import { UsageService } from '../services/usage.service';
import { buildExportPayload, type ExportFormat, type ExportPayload } from '../utils/export-serializer';

@ApiTags('Billing')
@ApiBearerAuth()
// DESIGN §7 locks this at membership ≥ ADMIN (admins + owners).
@WorkspaceAccess('ADMIN', { param: 'workspaceId' })
@Controller({ path: 'workspaces/:workspaceId/audit', version: '1' })
export class AuditExportController {
  constructor(
    @Inject(UsageService) private readonly usage: UsageService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export the full workspace audit log (Team feature)' })
  public async exportAudit(
    @Param('workspaceId') workspaceId: string,
    @Query('format') format: string = 'json',
  ): Promise<ExportPayload> {
    // No enum pipe on the query string — validate the two accepted values
    // explicitly so unknown formats fall back to JSON instead of 400ing.
    const effectiveFormat: ExportFormat = format === 'csv' ? 'csv' : 'json';
    await this.usage.requireFeature(workspaceId, BILLING_FEATURES.AUDIT_LOG_EXPORT);
    const rows = await this.audit.exportWorkspace(workspaceId);
    return buildExportPayload(rows, effectiveFormat);
  }
}
```

Register `AuditExportController` in `BillingModule`'s `controllers` array.

- [ ] **Step 7: Run tests + build**

Run: `pnpm --filter api test && pnpm --filter api build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/audit apps/api/src/modules/billing
git commit -m "feat(billing): add team-only workspace audit-log export"
```

---

### Task 10: Web UI — plan card, upgrade notice, export, admin view

**Files:**
- Create: `apps/web/lib/billing.ts`
- Modify: `apps/web/app/workspaces/[workspaceId]/page.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/_components/upgrade-notice.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/_components/billing-section.tsx`
- Modify: `apps/web/app/workspaces/[workspaceId]/_components/settings-tab.tsx`
- Modify: `apps/web/app/workspaces/[workspaceId]/_components/activity-tab.tsx`
- Modify: `apps/web/lib/workspaces.ts` (AuditEvent type is already here — check nothing else uses it)

No web unit-test framework exists (the API owns jest). Verification for every step is `rm -rf apps/web/.next && pnpm --filter web lint && pnpm --filter web check-types && pnpm --filter web build`.

**Interfaces:**
- Consumes: `GET /workspaces/:workspaceId/subscription`, `POST /billing/checkout`, `POST /billing/portal`, `GET /workspaces/:workspaceId/audit/export` (all unwrapped by `lib/api.ts`).
- Produces: `billingApi.getSubscription`, `billingApi.checkout`, `billingApi.portal`, `billingApi.exportAudit` in `apps/web/lib/billing.ts`; `SubscriptionInfo` type.

- [ ] **Step 1: Create the web billing library**

Create `apps/web/lib/billing.ts`:

```ts
import { api } from './api';

export type BillingPlan = 'FREE' | 'PRO' | 'TEAM';

export type SubscriptionInfo = {
  workspaceId: string;
  plan: BillingPlan;
  status: string;
  currentPeriodEnd: string | null;
};

export const PLAN_LABELS: Record<BillingPlan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
};

export const PLACEHOLDER_PRICES: Record<'PRO' | 'TEAM', { monthly: string }> = {
  // TODO: confirm pricing before launch (keep in sync with the API)
  PRO: { monthly: '$0' },
  TEAM: { monthly: '$0' },
};

export const billingApi = {
  getSubscription: (workspaceId: string) =>
    api.get<SubscriptionInfo>(`/workspaces/${workspaceId}/subscription`),

  checkout: (workspaceId: string, plan: 'PRO' | 'TEAM') =>
    api.post<{ url: string }>('/billing/checkout', { workspaceId, plan }),

  portal: (workspaceId: string) =>
    api.post<{ url: string }>('/billing/portal', { workspaceId }),

  exportAudit: async (workspaceId: string, format: 'json' | 'csv') => {
    const payload = await api.get<{ fileName: string; contentType: string; data: string }>(
      `/workspaces/${workspaceId}/audit/export?format=${format}`,
    );
    const blob = new Blob([payload.data], { type: payload.contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = payload.fileName;
    a.click();
    URL.revokeObjectURL(url);
  },
};
```

- [ ] **Step 2: Wire subscription + UpgradeNotice into the workspace page**

In `apps/web/app/workspaces/[workspaceId]/page.tsx`:
- Import `billingApi, type SubscriptionInfo` from `@/lib/billing` and `UpgradeNotice` from `./_components/upgrade-notice`.
- Add state: `const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);`
- IMPORTANT: members currently load only when the Members tab is open, so on a first visit to Settings `members` is empty and `currentRole` would be `null` (hiding the upgrade button). Fetch members with the initial load:
- In `loadWorkspace`, extend the `Promise.all` (note `loadMembers` stays as-is for the Members tab — this just prewarms the role):

```ts
    Promise.all([
      workspacesApi.getById(workspaceId),
      boardsApi.list(workspaceId),
      billingApi.getSubscription(workspaceId).catch(() => null),
      workspacesApi.getMembers(workspaceId).catch(() => []),
    ])
      .then(([ws, boardList, subInfo, memberList]) => {
        setWorkspace(ws);
        setBoards(boardList);
        setSubscription(subInfo);
        setMembers(memberList);
      })
```

(`getMembers` is typed `Promise<WorkspaceMember[]>`, so the `.catch(() => [])` fallback type-checks; a non-member can never reach this page because the route is membership-guarded.)

- Compute the viewer role for billing management: `const currentRole = members.find((m) => m.userId === user?.id)?.role ?? null;`
- Render the notice between `</header>` and `<div className="flex-1 overflow-auto">`:

```tsx
        <UpgradeNotice
          plan={subscription?.plan ?? 'FREE'}
          boardCount={workspace.boardCount}
          memberCount={workspace.memberCount}
          onUpgrade={() => setTab('settings')}
        />
```

- Pass props to tabs:
  - `SettingsTab`: add `subscription={subscription}` and `currentRole={currentRole}`.
  - `ActivityTabContent`: add `plan={subscription?.plan ?? 'FREE'}`.

- [ ] **Step 3: Create the UpgradeNotice component**

Create `apps/web/app/workspaces/[workspaceId]/_components/upgrade-notice.tsx`:

```tsx
'use client';

import { Sparkles } from 'lucide-react';

type Props = {
  plan: 'FREE' | 'PRO' | 'TEAM';
  boardCount: number;
  memberCount: number;
  onUpgrade: () => void;
};

export function UpgradeNotice({ plan, boardCount, memberCount, onUpgrade }: Props) {
  const atLimit = boardCount >= 3 || memberCount >= 3;
  if (plan !== 'FREE' || !atLimit) return null;

  const over = boardCount > 3 || memberCount > 3;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-900/40 bg-amber-950/40 px-8 py-2.5">
      <p className="flex items-center gap-2 text-xs text-amber-300">
        <Sparkles size={14} />
        {over
          ? `You're over the Free plan limits (${boardCount}/3 boards, ${memberCount}/3 members). Upgrade to keep creating.`
          : `You're at the Free plan limits (boards 3, members 3). Upgrade for unlimited everything.`}
      </p>
      <button
        onClick={onUpgrade}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500"
      >
        Upgrade
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create the billing section component**

Create `apps/web/app/workspaces/[workspaceId]/_components/billing-section.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import {
  billingApi,
  PLAN_LABELS,
  PLACEHOLDER_PRICES,
  type SubscriptionInfo,
} from '@/lib/billing';
import { useToast } from '@/contexts/toast-context';

type Props = {
  workspaceId: string;
  subscription: SubscriptionInfo | null;
  canManage: boolean;
  boardCount: number;
  memberCount: number;
  onChanged: () => void;
};

function usageLabel(current: number, limit: number | null): string {
  return limit === null ? `${current} / unlimited` : `${current} / ${limit}`;
}

export function BillingSection({ workspaceId, subscription, canManage, boardCount, memberCount, onChanged }: Props) {
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);
  const toast = useToast();
  const plan = subscription?.plan ?? 'FREE';

  async function upgrade(target: 'PRO' | 'TEAM') {
    setBusy('checkout');
    try {
      const { url } = await billingApi.checkout(workspaceId, target);
      window.location.href = url;
    } catch {
      toast.error('Could not start checkout. Try again.');
      setBusy(null);
    }
  }

  async function manage() {
    setBusy('portal');
    try {
      const { url } = await billingApi.portal(workspaceId);
      window.location.href = url;
    } catch {
      toast.error('Could not open billing. Try again.');
      setBusy(null);
    }
  }

  const paid = plan !== 'FREE';
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard size={14} className="text-surface-500" />
          Plan &amp; billing
        </h3>
        <span className="rounded-full bg-surface-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-300">
          {PLAN_LABELS[plan]}
          {!subscription || subscription.status !== 'ACTIVE' ? ` · ${subscription?.status ?? 'ACTIVE'}` : ''}
        </span>
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-surface-400">Boards</dt>
          <dd className="text-surface-200">{usageLabel(boardCount, plan === 'FREE' ? 3 : null)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-surface-400">Members</dt>
          <dd className="text-surface-200">{usageLabel(memberCount, plan === 'FREE' ? 3 : null)}</dd>
        </div>
        {paid && periodEnd && (
          <div className="flex justify-between">
            <dt className="text-surface-400">Renews</dt>
            <dd className="text-surface-200">{periodEnd}</dd>
          </div>
        )}
      </dl>

      {canManage &&
        (paid ? (
          <button
            onClick={manage}
            disabled={busy !== null}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-700 px-3 py-2 text-xs font-medium text-surface-300 hover:border-primary-600 hover:text-primary-300 disabled:opacity-50"
          >
            <ExternalLink size={13} />
            {busy === 'portal' ? 'Opening…' : 'Manage billing'}
          </button>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => upgrade('PRO')}
              disabled={busy !== null}
              className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              Upgrade to Pro · {PLACEHOLDER_PRICES.PRO.monthly}/mo
            </button>
            <button
              onClick={() => upgrade('TEAM')}
              disabled={busy !== null}
              className="rounded-lg border border-primary-700/60 px-3 py-2 text-xs font-medium text-primary-300 hover:bg-primary-900/40 disabled:opacity-50"
            >
              Upgrade to Team · {PLACEHOLDER_PRICES.TEAM.monthly}/mo
            </button>
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 5: Add the billing section to the settings tab**

In `apps/web/app/workspaces/[workspaceId]/_components/settings-tab.tsx`:
- Extend `Props` with `subscription: SubscriptionInfo | null` and `currentRole: string | null` (import `SubscriptionInfo` from `@/lib/billing`).
- Import `BillingSection` from `./billing-section`.
- Compute `const canManage = currentRole === 'ADMIN' || currentRole === 'OWNER';`
- Render `<BillingSection ... />` at the top of the settings card (before the name/description inputs), passing `workspaceId`, `subscription`, `canManage`, `boardCount={workspace.boardCount}`, `memberCount={workspace.memberCount}`, `onChanged={onUpdate}`. Reuse the existing `max-w-lg p-6` container.

- [ ] **Step 6: Add export buttons to the activity tab**

In `apps/web/app/workspaces/[workspaceId]/_components/activity-tab.tsx`:
- Extend props with `plan: 'FREE' | 'PRO' | 'TEAM'`.
- Import `billingApi` from `@/lib/billing`, `Download` from `lucide-react`, `useToast` from `@/contexts/toast-context`.
- When `plan === 'TEAM'`, render under the heading a small toolbar:

```tsx
      {plan === 'TEAM' && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => billingApi.exportAudit(workspaceId, 'csv').catch(() => toast.error('Export failed.'))}
            className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-300 hover:border-primary-600 hover:text-primary-300"
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={() => billingApi.exportAudit(workspaceId, 'json').catch(() => toast.error('Export failed.'))}
            className="flex items-center gap-1.5 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-surface-300 hover:border-primary-600 hover:text-primary-300"
          >
            <Download size={13} /> Export JSON
          </button>
        </div>
      )}
```

- [ ] **Step 7: Verify web**

Run: `rm -rf apps/web/.next && pnpm --filter web lint && pnpm --filter web check-types && pnpm --filter web build`
Expected: PASS with zero lint warnings.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/billing.ts apps/web/app/workspaces
git commit -m "feat(web): add plan & billing UI with upgrade notice and audit export"
```

---

### Task 11: Full-suite verification, manual smoke, and push

**Files:** none (verification only).

- [ ] **Step 1: API suite + build + lint**

Run: `pnpm --filter api test && pnpm --filter api build && pnpm --filter api lint`
Expected: all pass; test count grows past 41 suites / 297 tests; lint baseline is still only the 25 known warnings in `ai.service.spec.ts` + `canvas.service.spec.ts`.

- [ ] **Step 2: Web suite**

Run: `rm -rf apps/web/.next && pnpm --filter web lint && pnpm --filter web check-types && pnpm --filter web build`
Expected: PASS, zero warnings.

- [ ] **Step 3: Re-run the migration against podman Postgres (from Task 1)**

Start the container (if not still running), run `pnpm --filter @repo/database build` then `pnpm --filter @repo/database migrate`, and verify:
```bash
podman exec pg-billing psql -U workspace -d workspace -c "SELECT plan, count(*) FROM workspace_subscriptions GROUP BY plan;"
podman exec pg-billing psql -U workspace -d workspace -c "SELECT count(*) FROM workspaces WHERE deleted_at IS NULL;"
```
Re-running the migrate (already-migrated DB) must exit 0 with only the `42P07` NOTICE (the render.yaml CI behavior). Then clean up: `podman rm -f pg-billing`.

- [ ] **Step 4: Folded-in checks**

Run:
```bash
grep -rn "STUB_SUBSCRIPTION\|admin/users/.*/subscription\|getSubscription(" apps/api apps/web --include=*.ts --include=*.tsx
```
Expected: ZERO matches (check #2 — no orphaned admin-route callers).

Confirm `STRIPE_WEBHOOK_SECRET` is required at boot when `STRIPE_SECRET_KEY` is set by running the env-schema spec (`pnpm --filter api test apps/api/src/config/env.schema.spec.ts` or the full suite) — check #3 already covered by Task 6's passing spec.

- [ ] **Step 5: Smoke-test the running API against podman Postgres**

With the API booted (`pnpm --filter api start:dev` against `DATABASE_URL=postgresql://workspace:workspace123@localhost:5433/workspace`):
- `GET /api/v1/workspaces/:id/subscription` → `{ plan:'FREE', status:'ACTIVE' }` for any workspace under the auth token.
- Creating a 4th board on a FREE workspace → 422 `BILLING.LIMIT_REACHED` with `error.details`.
- `POST /api/v1/billing/checkout` → 503 `BILLING.NOT_CONFIGURED` while `STRIPE_SECRET_KEY` is unset (expected, no keys in this environment — the live round-trip is the recorded blocker).
- `POST /api/v1/billing/webhook` without a signature → 400 `BILLING.WEBHOOK_INVALID`; with a garbage signature → 400/500 (Stripe `SignatureVerificationError`).

- [ ] **Step 6: Commit any stragglers, then push**

Run: `git status && git log --oneline -15`
Review the diff for stray files, then push (note: the two design-doc commits `d8a9902`, `1a645ef` are currently NOT on origin — they ride along):

```bash
git push origin main
```

- [ ] **Step 7: Record the remaining blocker**

The live Stripe round-trip (real checkout, real webhook delivery, real portal) is blocked on: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_TEAM_MONTHLY` in the deploy env, and registering `https://workspace-api-8387.onrender.com/api/v1/billing/webhook` in the Stripe dashboard. Notify the user this must be completed by hand after deploy.