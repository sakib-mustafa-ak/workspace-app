# Phase 2 Implementation Plan: Closing Remaining SaaS Gaps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the seven remaining SaaS gaps: audit coverage, Postgres full-text search, push-scaffold removal, active-workspace persistence, notification preferences + email delivery, minimal platform admin with impersonation, and onboarding.

**Architecture:** All seven changes are independent subsystems on a shared schema that grows in one migration. Server work follows the existing NestJS conventions (module → service → repository, event-bus handlers for side effects). Client work follows the existing `lib/*` + `contexts/*` + route-group structure.

**Tech Stack:** NestJS 11 (API), Next.js 16 + React 19 (web), Drizzle ORM + PostgreSQL (storage), decorator-driven event bus (`node:events`), Socket.IO fan-out for in-app notifications.

**Spec:** `docs/superpowers/specs/2026-08-27-phase2-saas-gaps-design.md` — the plan argues from the spec, so the spec travels with it; executors read both.

## Global Constraints

- **No new infrastructure.** Search uses Postgres built-in `tsvector`/`websearch_to_tsquery`/`ts_rank`; no external search service.
- **Keep the notification_type enum unchanged.** No new values (`MENTION_CREATED` stays inert). Invitation emails read the `MEMBER_ADDED` pref (closest existing semantic).
- **Admin is platform-level and DB-checked.** `AdminGuard` checks `request.user.isAdmin`, which `JwtAuthGuard` refreshes from the DB on every request — never trust the token `role` claim alone.
- **Approve code style without inline comments** unless the surrounding file already explains intent (existing files carry doc comments; new code should match the module's local convention).
- **Public UI text is `surface`/`primary`/`warm` tokens only** — Tailwind classes, no new palette.
- **Pre-commit hook runs eslint on staged files.** Keep new/changed files clean of new errors; 25 pre-existing `no-unsafe-argument` warnings exist in API `.spec.ts` files — do not "fix" them.
- **API verification commands:** `pnpm --filter @repo/api build` (typecheck via `nest build`), `pnpm --filter @repo/api test`, `pnpm --filter @repo/api lint`.
- **Web verification commands:** `pnpm --filter @repo/web lint` (`eslint --max-warnings 0`), `pnpm --filter @repo/web check-types`, `pnpm --filter @repo/web build`.
- **Migration generation runs offline** via `pnpm --filter @repo/database generate` — it does not need a running Postgres (no local DB exists; do NOT try `drizzle-kit migrate`).
- **Every task commits independently** with a conventional message (`feat:`, `refactor:`, `chore:`, `fix:`).

---

## Task Map / Dependencies

| # | Task | Depends on |
|---|------|-----------|
| 1 | Database schema (`is_admin`, prefs, admin audit, search vectors, drop push) + migration | — |
| 2 | Remove push notification scaffold | 1 (for the schema drop) |
| 3 | Audit handlers for task/comment/upload/canvas + payload extensions | — |
| 4 | Postgres full-text search (repos + service + tests) | 1 (search_vector columns) |
| 5 | Notification preferences API + email on invite/assignment | 1 (prefs table) |
| 6 | Active workspace persistence + sidebar fixes | — |
| 7 | Notification preferences UI (settings tab) | 5 |
| 8 | Platform admin role: `CurrentUser.isAdmin`, JWT claim + `impersonatorId`, `AdminGuard`, `FORBIDDEN` code, DTO surfacing, web `User.isAdmin` | 1 (is_admin) |
| 9 | Admin module: lookups, subscription stub, impersonation, admin audit | 8 |
| 10 | Onboarding flow UI | 6 |
| 11 | Admin UI + impersonation client | 9 |

---

### Task 1: Database Schema + Migration

**Files:**
- Modify: `packages/database/src/schema/common.ts` (add `tsvector` customType helper)
- Modify: `packages/database/src/schema/boards/board.schema.ts` (search_vector column + GIN index)
- Modify: `packages/database/src/schema/tasks/task.schema.ts` (search_vector column + GIN index)
- Modify: `packages/database/src/schema/users/user.schema.ts` (`isAdmin`)
- Create: `packages/database/src/schema/notifications/notification-preference.constants.ts`
- Create: `packages/database/src/schema/notifications/notification-preference.schema.ts`
- Modify: `packages/database/src/schema/notifications/index.ts` (export pref, drop push export)
- Delete: `packages/database/src/schema/notifications/push-subscriptions.ts`
- Create: `packages/database/src/schema/audit/admin-audit-log.constants.ts`
- Create: `packages/database/src/schema/audit/admin-audit-log.schema.ts`
- Modify: `packages/database/src/schema/audit/index.ts`
- Generated: `packages/database/src/migrations/0006_*.sql` + `meta/0006_snapshot.json` + journal entry

**Interfaces:**
- Consumes: existing `PRIMARY_ID`, `CREATED_AT`, `UPDATED_AT`, index/uniqueIndex helpers.
- Produces (used by later tasks):
  - `tsvector` column customType exported from `common.ts`.
  - `boards.searchVector` / `tasks.searchVector` generated tsvector columns.
  - `users.isAdmin` boolean (default `false`) → flows into `UserRow.isAdmin`.
  - `notificationPreferences` table (composite PK `userId`+`type`).
  - `adminAuditLog` table.
  - Removed `pushSubscriptions` table.

**Steps:**

- [ ] **Step 1: Add the tsvector customType helper**

In `packages/database/src/schema/common.ts`, append a shared custom type (drizzle's built-in types have no `tsvector`):

```ts
import { customType } from 'drizzle-orm/pg-core';

/**
 * PostgreSQL `tsvector` column, used for generated full-text search
 * columns. `data`/`driverData` are both strings; Postgres casts the
 * output of a stored generated expression to the column type.
 */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});
```

Add `customType` to the existing `drizzle-orm/pg-core` import line.

- [ ] **Step 2: Add search_vector to boards**

In `packages/database/src/schema/boards/board.schema.ts`:
1. Import `tsvector` from `../common.js` and `generatedAlwaysAs` is not needed (use `tsvector().generatedAlwaysAs(...)`).
2. Add the column and index:

```ts
searchVector: tsvector('search_vector')
  .generatedAlwaysAs(
    sql`to_tsvector('english', name || ' ' || COALESCE(description, ''))`,
  )
  .stored(),
```

And in the table callback add:

```ts
boardsSearchVectorIdx: index('boards_search_vector_idx').using(
  'gin',
  table.searchVector,
),
```

**Note:** drizzle's `generatedAlwaysAs(as, { mode: 'stored' })` accepts `{ mode: 'stored' }` — pass the options object explicitly to guarantee `STORED` output: `.stored()` is equivalent shorthand. If `.stored()` does not type-check on your drizzle version, use `.generatedAlwaysAs(sql\`to_tsvector('english', name || ' ' || COALESCE(description, ''))\`, { mode: 'stored' })`.

- [ ] **Step 3: Add search_vector to tasks**

In `packages/database/src/schema/tasks/task.schema.ts`:

```ts
searchVector: tsvector('search_vector')
  .generatedAlwaysAs(sql`to_tsvector('english', title)`)
  .stored(),
```

Table callback:

```ts
tasksSearchVectorIdx: index('tasks_search_vector_idx').using(
  'gin',
  table.searchVector,
),
```

- [ ] **Step 4: Add isAdmin to users**

In `packages/database/src/schema/users/user.schema.ts`, after `passwordHash`:

```ts
isAdmin: boolean('is_admin').notNull().default(false),
```

Add `boolean` to the `drizzle-orm/pg-core` import.

- [ ] **Step 5: Create the notification_preferences schema**

Create `packages/database/src/schema/notifications/notification-preference.constants.ts`:

```ts
export const notificationPreferencesTableName = 'notification_preferences';
export const notificationPreferenceAlias = 'notification_preferences';
```

Create `packages/database/src/schema/notifications/notification-preference.schema.ts`:

```ts
import { boolean, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';

import { notificationTypeEnum } from '../enums/notification.enums.js';
import { users } from '../users/user.schema.js';
import {
  notificationPreferenceAlias,
  notificationPreferencesTableName,
} from './notification-preference.constants.js';

export const notificationPreferences = pgTable(
  notificationPreferencesTableName,
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.type] }),
  }),
);

export type NotificationPreferenceRow =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferenceRow =
  typeof notificationPreferences.$inferInsert;

export const notificationPreferenceAccess = {
  table: notificationPreferences,
  alias: notificationPreferenceAlias,
};
```

- [ ] **Step 6: Create the admin_audit_log schema**

Create `packages/database/src/schema/audit/admin-audit-log.constants.ts`:

```ts
export const adminAuditLogTableName = 'admin_audit_log';
export const adminAuditLogAlias = 'admin_audit_log';
```

Create `packages/database/src/schema/audit/admin-audit-log.schema.ts`:

```ts
import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { CREATED_AT, PRIMARY_ID } from '../common.js';
import { users } from '../users/user.schema.js';

import {
  adminAuditLogAlias,
  adminAuditLogTableName,
} from './admin-audit-log.constants.js';

/**
 * Platform-level admin audit trail. Deliberately NOT tied to a
 * `workspaceId` — admins act across tenants — so it is a sibling of
 * `audit_events`, not a special case of it.
 */
export const adminAuditLog = pgTable(
  adminAuditLogTableName,
  {
    id: PRIMARY_ID(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: CREATED_AT(),
  },
  (table) => ({
    adminAuditActorIdx: index('admin_audit_actor_idx').on(table.actorId),
    adminAuditTargetIdx: index('admin_audit_target_idx').on(
      table.targetType,
      table.targetId,
    ),
    adminAuditCreatedAtIdx: index('admin_audit_created_at_idx').on(
      table.createdAt,
    ),
  }),
);

export type AdminAuditLogRow = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLogRow = typeof adminAuditLog.$inferInsert;

export const adminAuditLogAccess = {
  table: adminAuditLog,
  alias: adminAuditLogAlias,
};
```

- [ ] **Step 7: Rewire the index files**

`packages/database/src/schema/notifications/index.ts` — replace the push export:

```ts
export * from './notification.constants.js';
export * from './notification.schema.js';
export * from './notification-preference.constants.js';
export * from './notification-preference.schema.js';
```

Delete `packages/database/src/schema/notifications/push-subscriptions.ts`.

`packages/database/src/schema/audit/index.ts` — add (create the file if missing):

```ts
export * from './admin-audit-log.constants.js';
export * from './admin-audit-log.schema.js';
export * from './audit.constants.js';
export * from './audit.schema.js';
```

(Verify the existing `audit/index.ts` content and append the two new exports instead of rewriting.)

- [ ] **Step 8: Verify the schema package compiles**

Run: `pnpm --filter @repo/database build`
Expected: clean tsc output. (If no build script exists in the package, use `pnpm --filter @repo/api build` which type-checks the schema through `@repo/database` imports.)

- [ ] **Step 9: Run typecheck through the API**

Run: `pnpm --filter @repo/api build`
Expected: clean — `UserRow` now has `isAdmin`; nothing else references push_subscriptions in the schema package.

- [ ] **Step 10: Generate the migration**

Run: `pnpm --filter @repo/database generate`
Expected: a new file `packages/database/src/migrations/0006_*.sql` + `meta/0006_snapshot.json`, journal updated.

Open the generated `0006_*.sql` and confirm it contains, in any order:
1. `DROP TABLE "push_subscriptions"` (and its two index drops).
2. `ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL`.
3. `CREATE TABLE "notification_preferences"` with `user_id`, `type`, `email_enabled`, `in_app_enabled`, `updated_at`, PK on `(user_id, type)`, FK to users.
4. `CREATE TABLE "admin_audit_log"` with FK to users on `actor_id`.
5. `ALTER TABLE "boards" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || COALESCE(description, ''))) STORED` and `CREATE INDEX ... USING gin (search_vector)`.
6. `ALTER TABLE "tasks" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', title)) STORED` and a GIN index.

**If any piece is missing** (especially the GIN indexes or `STORED`), hand-append the missing `ALTER TABLE`/`CREATE INDEX` statements to the bottom of `0006_*.sql` using the `--> statement-breakpoint` separator and the style above. The snapshot only needs to be exact for future diffs; `drizzle-kit migrate` executes the SQL files.

- [ ] **Step 11: Run the API test suite**

Run: `pnpm --filter @repo/api test`
Expected: all existing tests pass (schema change alone breaks nothing).

- [ ] **Step 12: Commit**

```bash
git add packages/database/src/schema packages/database/src/migrations
git commit -m "feat(db): add admin flag, notification prefs, admin audit, search vectors"
```

---

### Task 2: Remove Push Notification Scaffold

**Files:**
- Delete: `apps/api/src/modules/notifications/services/web-push.service.ts`
- Delete: `apps/api/src/modules/notifications/services/push-subscriptions.service.ts`
- Delete: `apps/api/src/modules/notifications/controllers/push-subscriptions.controller.ts`
- Delete: `apps/api/src/modules/notifications/repositories/push-subscriptions.repository.ts`
- Delete: `apps/api/scripts/generate-vapid-keys.ts`
- Delete: `apps/web/public/sw.js`
- Delete: `apps/web/hooks/use-push-notifications.ts`
- Modify: `apps/api/src/modules/notifications/notifications.module.ts` (remove controller/providers/exports)
- Modify: `apps/api/src/modules/notifications/services/notifications.service.ts` (drop push injection + `sendToUser` call)
- Modify: `apps/api/src/modules/notifications/services/notifications.service.spec.ts` (drop push mock/provider)
- Modify: `apps/api/package.json` (remove `web-push`, `@types/web-push`)
- Modify: `render.yaml` (remove VAPID keys)
- Modify: `.env.example` (remove VAPID entries if present — currently they are NOT present)
- Modify: `apps/web/package.json` (remove `web-push` dep if present; the app only referenced the hook)

**Interfaces:**
- Consumes: Task 1 (the `push_subscriptions` table no longer exists).
- Produces: `NotificationsService` with only in-app delivery. `notifications.events` untouched.

**Steps:**

- [ ] **Step 1: Scan for all push references**

Run these greps (ripgrep) and record every hit before deleting:
`rg -l "web-push|vapid|VAPID|push_subscriptions|pushManager|sw\.js|use-push-notifications|getSubscription" apps packages render.yaml .env.example --glob '!**/dist/**'`

Every hit must be addressed by this task (delete, edit, or dismiss with reason). Expected hits:
- The 4 API files + `generate-vapid-keys.ts` → delete.
- `apps/web/public/sw.js`, `apps/web/hooks/use-push-notifications.ts` → delete.
- `render.yaml` lines 23-28 → remove the VAPID block.
- `apps/web/package.json` references to the hook/`web-push` → remove.
- `apps/api/package.json` `web-push` + `@types/web-push` → remove.
- `apps/api/src/modules/notifications/notifications.module.ts`, `services/notifications.service.ts`, `services/notifications.service.spec.ts` → edit.
- `apps/api/dist/**` → leave (build artifacts, regenerated on `nest build`).

- [ ] **Step 2: Delete the API files**

```bash
git rm apps/api/src/modules/notifications/services/web-push.service.ts \
       apps/api/src/modules/notifications/services/push-subscriptions.service.ts \
       apps/api/src/modules/notifications/controllers/push-subscriptions.controller.ts \
       apps/api/src/modules/notifications/repositories/push-subscriptions.repository.ts \
       apps/api/scripts/generate-vapid-keys.ts
```

- [ ] **Step 3: Delete the web files**

```bash
git rm apps/web/public/sw.js apps/web/hooks/use-push-notifications.ts
```

- [ ] **Step 4: Clean notifications.module.ts**

Remove the imports/providers/exports for `PushSubscriptionsController`, `PushSubscriptionsService`, `PushSubscriptionsRepository`, `WebPushService`. Remove the controller from the `controllers` array and the providers from `providers`. The `exports` array keeps only `NotificationsService` and `NotificationsEventBus`.

Expected final `controllers: [NotificationsController]`, `exports: [NotificationsService, NotificationsEventBus]`.

- [ ] **Step 5: Clean NotificationsService**

In `apps/api/src/modules/notifications/services/notifications.service.ts`:
1. Remove `import { PushSubscriptionsService }...`.
2. Remove the `@Inject(PushSubscriptionsService)` constructor parameter and its field.
3. In `createAndDeliver`, remove the `await this.pushSubscriptions.sendToUser(...)` block so the body is:

```ts
public async createAndDeliver(
  userId: string,
  input: {
    type: NotificationType;
    title: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
  },
): Promise<NotificationRow> {
  const notification = await this.create(userId, input);
  await this.notificationsRepo.deliver(notification.id);
  return notification;
}
```

- [ ] **Step 6: Clean the notifications service spec**

In `notifications.service.spec.ts`: remove the `import { PushSubscriptionsService }`, the `provide: PushSubscriptionsService` entry in the test module, and any `pushSubscriptions` mock wiring in `beforeEach`. Keep the assertions on in-app delivery.

- [ ] **Step 7: Remove the npm dependency**

In `apps/api/package.json`, delete the `"web-push": "^3.6.7"` and `"@types/web-push": "^3.6.4"` entries, then run `pnpm install` to prune.

- [ ] **Step 8: Remove VAPID from render.yaml**

Delete the `- key: VAPID_PUBLIC_KEY`, `- key: VAPID_PRIVATE_KEY`, `- key: VAPID_SUBJECT` entries (render.yaml lines ~23-28, including the `value:` line).

- [ ] **Step 9: Remove push deps from web package.json**

In `apps/web/package.json`, drop any `web-push`/web-push-types entries found in Step 1. Run `pnpm install`.

- [ ] **Step 10: Verify no stragglers remain**

Re-run the Step 1 ripgrep against `apps packages render.yaml .env.example --glob '!**/dist/**'`. Expected: zero hits. Also confirm `.env` itself has no VAPID keys (the grep source of truth is `.env`, `.env.example`, `render.yaml`).

- [ ] **Step 11: Build, lint, test**

Run: `pnpm --filter @repo/api build` then `pnpm --filter @repo/api test` then `pnpm --filter @repo/api lint`. Run web: `pnpm --filter @repo/web check-types` and `pnpm --filter @repo/web lint`.
Expected: clean (the API spec that previously mocked PushSubscriptionsService compiles/ passes).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: remove dead web-push scaffold"
```

---

### Task 3: Audit Handlers for Task / Comment / Upload / Canvas

**Files:**
- Modify: `apps/api/src/modules/tasks/events/tasks.events.ts` (payloads gain `workspaceId` + `boardId`)
- Modify: `apps/api/src/modules/tasks/services/tasks.service.ts` (publish sites)
- Modify: `apps/api/src/modules/comments/events/comments.events.ts` (payloads gain `workspaceId`)
- Modify: `apps/api/src/modules/comments/services/comments.service.ts` (publish sites)
- Modify: `apps/api/src/modules/canvas/events/canvas.events.ts` (payloads gain `workspaceId`)
- Modify: `apps/api/src/modules/canvas/services/canvas.service.ts` (publish sites)
- Create: `apps/api/src/modules/audit/handlers/task-audit.handler.ts`
- Create: `apps/api/src/modules/audit/handlers/comment-audit.handler.ts`
- Create: `apps/api/src/modules/audit/handlers/upload-audit.handler.ts`
- Create: `apps/api/src/modules/audit/handlers/canvas-audit.handler.ts`
- Create: `apps/api/src/modules/audit/handlers/task-audit.handler.spec.ts`
- Create: `apps/api/src/modules/audit/handlers/comment-audit.handler.spec.ts`
- Create: `apps/api/src/modules/audit/handlers/upload-audit.handler.spec.ts`
- Create: `apps/api/src/modules/audit/handlers/canvas-audit.handler.spec.ts`
- Modify: `apps/api/src/modules/audit/audit.module.ts` (imports + providers)

**Interfaces:**
- Consumes: `TasksEventBus`, `CommentsEventBus`, `UploadsEventBus`, `CanvasEventBus` (all exported), `AuditService` (exported), `BoardsRepository` (NOT exported from BoardsModule — provide it directly, matching `notifications.module.ts`).
- Produces: four `OnModuleInit` handlers whose constructors mirror `BoardAuditHandler`. Later tasks do not depend on these.

**Steps:**

- [ ] **Step 1: Extend task event payloads**

`apps/api/src/modules/tasks/events/tasks.events.ts` — all four payloads gain `workspaceId`; the three "no board id" payloads gain `boardId`:

```ts
export type TaskCreatedPayload = {
  taskId: string;
  workspaceId: string;
  boardId: string;
  columnId: string;
  createdBy: string;
  assigneeId?: string;
  title: string;
};

export type TaskUpdatedPayload = {
  taskId: string;
  workspaceId: string;
  boardId: string;
  updatedBy: string;
  title: string;
  previousAssigneeId: string | null;
  assigneeId: string | null;
};

export type TaskMovedPayload = {
  taskId: string;
  workspaceId: string;
  boardId: string;
  fromColumnId: string;
  toColumnId: string;
  movedBy: string;
};

export type TaskDeletedPayload = {
  taskId: string;
  workspaceId: string;
  boardId: string;
  deletedBy: string;
  title: string;
  assigneeId: string | null;
};
```

- [ ] **Step 2: Update the task publish sites**

`apps/api/src/modules/tasks/services/tasks.service.ts` — each publish call site has a `task` row (or `board`/`workspaceId` in scope):

- `publishTaskCreated`: add `workspaceId` (from the resolved `board.workspaceId` at the top of `create`).
- `publishTaskUpdated` (inside `update`): add `workspaceId: task.workspaceId, boardId: task.boardId`.
- `publishTaskMoved` (inside `move`): add `workspaceId: task.workspaceId, boardId: task.boardId`.
- `publishTaskDeleted` (inside `delete`): add `workspaceId: task.workspaceId, boardId: task.boardId`.

Verify each site's scope has those variables before adding (line numbers shift; the `task` row is always loaded before the publish). If only `workspaceId` is in scope but not `boardId`, read it from the `task` row loaded by `getTaskOrFail`-style calls.

- [ ] **Step 3: Extend comment event payloads**

`apps/api/src/modules/comments/events/comments.events.ts` — all three gain `workspaceId`:

```ts
export type CommentCreatedPayload = {
  commentId: string;
  workspaceId: string;
  boardId: string;
  userId: string;
  parentId?: string;
};

export type CommentUpdatedPayload = {
  commentId: string;
  workspaceId: string;
  boardId: string;
  userId: string;
};

export type CommentDeletedPayload = {
  commentId: string;
  workspaceId: string;
  boardId: string;
  deletedBy: string;
};
```

- [ ] **Step 4: Update the comment publish sites**

`apps/api/src/modules/comments/services/comments.service.ts` — every publish site already resolves `board` and has `board.workspaceId` in scope. Add `workspaceId: board.workspaceId` to `publishCommentCreated`, `publishCommentUpdated`, `publishCommentDeleted`.

- [ ] **Step 5: Extend canvas event payloads**

`apps/api/src/modules/canvas/events/canvas.events.ts` — all three gain `workspaceId`:

```ts
export type ObjectCreatedPayload = {
  objectId: string;
  workspaceId: string;
  canvasId: string;
  boardId: string;
  userId: string;
  type: string;
};

export type ObjectUpdatedPayload = {
  objectId: string;
  workspaceId: string;
  canvasId: string;
  boardId: string;
  userId: string;
};

export type ObjectDeletedPayload = {
  objectId: string;
  workspaceId: string;
  canvasId: string;
  boardId: string;
  deletedBy: string;
};
```

- [ ] **Step 6: Update the canvas publish sites**

`apps/api/src/modules/canvas/services/canvas.service.ts` — `getOrCreateCanvas`/object flows already carry `workspaceId` (from `board.workspaceId` and `loadObjectForBoard(...).workspaceId`). Add it to each of the three publishes.

- [ ] **Step 6b: Add the missing bus subscriber methods**

`TasksEventBus` has no `onTaskMoved`; add it next to `onTaskUpdated` in `apps/api/src/modules/tasks/events/tasks.events.ts`:

```ts
onTaskMoved(listener: (payload: TaskMovedPayload) => void): void {
  this.emitter.on(TASKS_EVENTS.taskMoved, listener);
}
```

`UploadsEventBus` has no `onFileDeleted`; add it next to `onFileUploaded` in `apps/api/src/modules/uploads/events/uploads.events.ts`:

```ts
onFileDeleted(listener: (payload: FileDeletedPayload) => void): void {
  this.emitter.on(UPLOADS_EVENTS.fileDeleted, listener);
}
```

- [ ] **Step 7: Write task-audit handler + spec**

Create `apps/api/src/modules/audit/handlers/task-audit.handler.ts`:

```ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { TasksEventBus } from '../../tasks/events/tasks.events';

@Injectable()
export class TaskAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(TasksEventBus) private readonly events: TasksEventBus,
  ) {}

  onModuleInit() {
    this.events.onTaskCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.createdBy,
        action: 'task.created',
        resourceType: 'task',
        resourceId: p.taskId,
        metadata: { boardId: p.boardId },
      });
    });

    this.events.onTaskUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.updatedBy,
        action: 'task.updated',
        resourceType: 'task',
        resourceId: p.taskId,
        metadata: { boardId: p.boardId, title: p.title },
      });
    });

    this.events.onTaskMoved((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.movedBy,
        action: 'task.moved',
        resourceType: 'task',
        resourceId: p.taskId,
        metadata: { boardId: p.boardId, fromColumnId: p.fromColumnId, toColumnId: p.toColumnId },
      });
    });

    this.events.onTaskDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'task.deleted',
        resourceType: 'task',
        resourceId: p.taskId,
        metadata: { boardId: p.boardId, title: p.title },
      });
    });
  }
}
```

Create `task-audit.handler.spec.ts` modeled on the notification handler spec style:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { TaskAuditHandler } from './task-audit.handler';
import { AuditService } from '../services/audit.service';
import { TasksEventBus } from '../../tasks/events/tasks.events';

describe('TaskAuditHandler', () => {
  let handler: TaskAuditHandler;
  let audit: { record: jest.Mock };
  let bus: TasksEventBus;

  beforeEach(async () => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskAuditHandler,
        TasksEventBus,
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    handler = module.get(TaskAuditHandler);
    bus = module.get(TasksEventBus);
  });

  it('records task.created via the event bus', () => {
    bus.publishTaskCreated({
      taskId: 't-1',
      workspaceId: 'ws-1',
      boardId: 'b-1',
      columnId: 'c-1',
      createdBy: 'u-1',
      title: 'Write spec',
    });
    expect(audit.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      action: 'task.created',
      resourceType: 'task',
      resourceId: 't-1',
      metadata: { boardId: 'b-1' },
    });
  });
});
```

Add analogous tests for `task.updated` and `task.deleted`/`task.moved`, each asserting the exact `audit.record` payload.

- [ ] **Step 8: Write comment-audit handler + spec**

```ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { CommentsEventBus } from '../../comments/events/comments.events';

@Injectable()
export class CommentAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CommentsEventBus) private readonly events: CommentsEventBus,
  ) {}

  onModuleInit() {
    this.events.onCommentCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'comment.created',
        resourceType: 'comment',
        resourceId: p.commentId,
        metadata: { boardId: p.boardId },
      });
    });

    this.events.onCommentUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'comment.updated',
        resourceType: 'comment',
        resourceId: p.commentId,
        metadata: { boardId: p.boardId },
      });
    });

    this.events.onCommentDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'comment.deleted',
        resourceType: 'comment',
        resourceId: p.commentId,
        metadata: { boardId: p.boardId },
      });
    });
  }
}
```

Spec mirrors Step 7 (publish on `bus`, assert one `audit.record` call per event).

- [ ] **Step 9: Write upload-audit handler + spec**

`UploadsEventBus` has `onFileUploaded` and (after Step 6b) `onFileDeleted`.

```ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { UploadsEventBus } from '../../uploads/events/uploads.events';

@Injectable()
export class UploadAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(UploadsEventBus) private readonly events: UploadsEventBus,
  ) {}

  onModuleInit() {
    this.events.onFileUploaded((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'file.uploaded',
        resourceType: 'file',
        resourceId: p.fileId,
        metadata: { boardId: p.boardId ?? null, originalName: p.originalName },
      });
    });

    this.events.onFileDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'file.deleted',
        resourceType: 'file',
        resourceId: p.fileId,
        metadata: {},
      });
    });
  }
}
```

- [ ] **Step 10: Write canvas-audit handler + spec**

```ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { AuditService } from '../services/audit.service';
import { CanvasEventBus } from '../../canvas/events/canvas.events';

@Injectable()
export class CanvasAuditHandler implements OnModuleInit {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CanvasEventBus) private readonly events: CanvasEventBus,
  ) {}

  onModuleInit() {
    this.events.onObjectCreated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'canvas.object.created',
        resourceType: 'canvas_object',
        resourceId: p.objectId,
        metadata: { canvasId: p.canvasId, boardId: p.boardId, type: p.type },
      });
    });

    this.events.onObjectUpdated((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.userId,
        action: 'canvas.object.updated',
        resourceType: 'canvas_object',
        resourceId: p.objectId,
        metadata: { canvasId: p.canvasId, boardId: p.boardId },
      });
    });

    this.events.onObjectDeleted((p) => {
      void this.audit.record({
        workspaceId: p.workspaceId,
        userId: p.deletedBy,
        action: 'canvas.object.deleted',
        resourceType: 'canvas_object',
        resourceId: p.objectId,
        metadata: { canvasId: p.canvasId, boardId: p.boardId },
      });
    });
  }
}
```

Spec mirrors the pattern: publish each event, assert one `audit.record` call.

- [ ] **Step 11: Wire the audit module**

> **Spec deviation (documented):** the spec lists `canvas.cleared` as an audited action, but neither `CanvasEventBus` nor the canvas service publishes a "cleared" event today. Auditing it would require inventing a publisher for a behavior that may not exist. This plan audits `canvas.object.created/updated/deleted` only; `canvas.cleared` is deferred until a clear feature exists.

Modify `apps/api/src/modules/audit/audit.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BoardsModule } from '../boards/boards.module';
import { TasksModule } from '../tasks/tasks.module';
import { CommentsModule } from '../comments/comments.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CanvasModule } from '../canvas/canvas.module';
import { BoardsRepository } from '../boards/repositories/boards.repository';
import { WorkspaceMembersRepository } from '../workspaces/repositories/workspace-members.repository';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';
import { WorkspaceAuditHandler } from './handlers/workspace-audit.handler';
import { BoardAuditHandler } from './handlers/board-audit.handler';
import { TaskAuditHandler } from './handlers/task-audit.handler';
import { CommentAuditHandler } from './handlers/comment-audit.handler';
import { UploadAuditHandler } from './handlers/upload-audit.handler';
import { CanvasAuditHandler } from './handlers/canvas-audit.handler';

@Module({
  imports: [
    WorkspacesModule,
    BoardsModule,
    TasksModule,
    CommentsModule,
    UploadsModule,
    CanvasModule,
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditRepository,
    WorkspaceMembersRepository,
    BoardsRepository,
    WorkspaceAuditHandler,
    BoardAuditHandler,
    TaskAuditHandler,
    CommentAuditHandler,
    UploadAuditHandler,
    CanvasAuditHandler,
  ],
  exports: [AuditService],
})
export class AuditModule {}
```

Verify there are no circular imports: `CanvasModule` already imports `BoardsModule`; the audit module is a leaf that those modules do not import.

- [ ] **Step 12: Build and run the audit tests**

Run: `pnpm --filter @repo/api build` then `pnpm --filter @repo/api test -- audit handlers`
Expected: build clean; the four new specs pass; no existing spec breaks from the payload type widening (extra fields are additive).

- [ ] **Step 13: Commit**

```bash
git add apps/api/src/modules/tasks apps/api/src/modules/comments apps/api/src/modules/canvas apps/api/src/modules/audit
git commit -m "feat(audit): cover tasks, comments, uploads, and canvas events"
```

---

### Task 4: Postgres Full-Text Search

**Files:**
- Modify: `apps/api/src/modules/boards/repositories/boards.repository.ts` (add `searchByQuery`)
- Modify: `apps/api/src/modules/tasks/repositories/tasks.repository.ts` (add `searchByQuery`)
- Modify: `apps/api/src/modules/search/services/search.service.ts` (rewrite `searchGlobal`)
- Modify: `apps/api/src/modules/search/services/search.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`boards.searchVector`, `tasks.searchVector` tsvector GIN columns).
- Produces:
  - `BoardsRepository.searchByQuery(workspaceIds: string[], query: string, limit?: number): Promise<Array<{ id: string; name: string; workspaceId: string }>>`
  - `TasksRepository.searchByQuery(workspaceIds: string[], query: string, limit?: number): Promise<Array<{ id: string; boardId: string; workspaceId: string; title: string }>>`
  - `SearchService.searchGlobal(userId, query)` keeps the exact same return shape `{ query, boards, tasks }`.

**Steps:**

- [ ] **Step 1: Add BoardsRepository.searchByQuery**

In `apps/api/src/modules/boards/repositories/boards.repository.ts`, verify the imports with `and`, `inArray`, `sql` (already present per the file header), then add:

```ts
public async searchByQuery(
  workspaceIds: string[],
  query: string,
  limit = 20,
): Promise<Array<{ id: string; name: string; workspaceId: string }>> {
  if (workspaceIds.length === 0) return [];
  const tsquery = sql`websearch_to_tsquery(${query})`;
  const rank = sql`ts_rank(${boards.searchVector}, websearch_to_tsquery(${query}))`;
  const rows = await this.db
    .select({
      id: boards.id,
      name: boards.name,
      workspaceId: boards.workspaceId,
    })
    .from(boards)
    .where(
      and(
        inArray(boards.workspaceId, workspaceIds),
        sql`${boards.deletedAt} IS NULL`,
        sql`${boards.searchVector} @@ websearch_to_tsquery(${query})`,
      ),
    )
    .orderBy(sql`${rank} desc`)
    .limit(limit);
  return rows;
}
```

- [ ] **Step 2: Add TasksRepository.searchByQuery**

In `apps/api/src/modules/tasks/repositories/tasks.repository.ts` (same import set), add:

```ts
public async searchByQuery(
  workspaceIds: string[],
  query: string,
  limit = 20,
): Promise<Array<{ id: string; boardId: string; workspaceId: string; title: string }>> {
  if (workspaceIds.length === 0) return [];
  const rank = sql`ts_rank(${tasks.searchVector}, websearch_to_tsquery(${query}))`;
  const rows = await this.db
    .select({
      id: tasks.id,
      boardId: tasks.boardId,
      workspaceId: tasks.workspaceId,
      title: tasks.title,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.workspaceId, workspaceIds),
        sql`${tasks.deletedAt} IS NULL`,
        sql`${tasks.searchVector} @@ websearch_to_tsquery(${query})`,
      ),
    )
    .orderBy(sql`${rank} desc`)
    .limit(limit);
  return rows;
}
```

Check the existing `tasks.repository.ts` imports include `and`, `inArray`, `sql`; add any that are missing (match boards repo's import style).

- [ ] **Step 3: Rewrite searchGlobal**

Replace the body of `SearchService.searchGlobal` in `apps/api/src/modules/search/services/search.service.ts`:

```ts
async searchGlobal(userId: string, query: string) {
  const cleanQuery = query?.trim() ?? '';
  if (!cleanQuery) {
    return { boards: [], tasks: [] };
  }

  const memberships = await this.membersRepo.listByUser(userId);
  const workspaceIds = memberships.map((m) => m.workspaceId);
  if (workspaceIds.length === 0) {
    return { query: cleanQuery, boards: [], tasks: [] };
  }

  const [boards, tasks] = await Promise.all([
    this.boardsRepo.searchByQuery(workspaceIds, cleanQuery, 20),
    this.tasksRepo.searchByQuery(workspaceIds, cleanQuery, 20),
  ]);

  return {
    query: cleanQuery,
    boards: boards.map((b) => ({
      id: b.id,
      title: b.name,
      workspaceId: b.workspaceId,
      type: 'board',
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      boardId: t.boardId,
      workspaceId: t.workspaceId,
      type: 'task',
    })),
  };
}
```

- [ ] **Step 4: Update the search spec**

Rewrite `apps/web/.../apps/api/src/modules/search/services/search.service.spec.ts` so the mocks match the new interface (the old spec mocked `listByWorkspace`/`listByBoard`, which no longer exist in the search path):

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { BoardsRepository } from '../../boards/repositories/boards.repository';
import { TasksRepository } from '../../tasks/repositories/tasks.repository';
import { WorkspaceMembersRepository } from '../../workspaces/repositories/workspace-members.repository';

describe('SearchService', () => {
  let service: SearchService;
  let boardsRepo: jest.Mocked<BoardsRepository>;
  let tasksRepo: jest.Mocked<TasksRepository>;
  let membersRepo: jest.Mocked<WorkspaceMembersRepository>;

  beforeEach(async () => {
    boardsRepo = {
      searchByQuery: jest.fn(),
    } as unknown as jest.Mocked<BoardsRepository>;
    tasksRepo = {
      searchByQuery: jest.fn(),
    } as unknown as jest.Mocked<TasksRepository>;
    membersRepo = {
      listByUser: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceMembersRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: BoardsRepository, useValue: boardsRepo },
        { provide: TasksRepository, useValue: tasksRepo },
        { provide: WorkspaceMembersRepository, useValue: membersRepo },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('returns empty results for an empty query', async () => {
    const res = await service.searchGlobal('user-1', '');
    expect(res.boards).toHaveLength(0);
    expect(res.tasks).toHaveLength(0);
  });

  it('returns mapped boards and tasks scoped to the user workspaces', async () => {
    membersRepo.listByUser.mockResolvedValue([
      { id: 'm-1', workspaceId: 'ws-1', userId: 'user-1' } as any,
    ]);
    boardsRepo.searchByQuery.mockResolvedValue([
      { id: 'b-1', name: 'Frontend Architecture', workspaceId: 'ws-1' } as any,
    ]);
    tasksRepo.searchByQuery.mockResolvedValue([
      { id: 't-1', boardId: 'b-1', workspaceId: 'ws-1', title: 'Fix login redirect' } as any,
    ]);

    const res = await service.searchGlobal('user-1', 'login');
    expect(res.query).toBe('login');
    expect(res.boards).toEqual([{ id: 'b-1', title: 'Frontend Architecture', workspaceId: 'ws-1', type: 'board' }]);
    expect(res.tasks).toEqual([{ id: 't-1', title: 'Fix login redirect', boardId: 'b-1', workspaceId: 'ws-1', type: 'task' }]);
    expect(boardsRepo.searchByQuery).toHaveBeenCalledWith(['ws-1'], 'login', 20);
    expect(tasksRepo.searchByQuery).toHaveBeenCalledWith(['ws-1'], 'login', 20);
  });

  it('returns empty results when the user has no workspaces', async () => {
    membersRepo.listByUser.mockResolvedValue([]);
    const res = await service.searchGlobal('user-1', 'anything');
    expect(res.boards).toHaveLength(0);
    expect(res.tasks).toHaveLength(0);
    expect(boardsRepo.searchByQuery).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Build, test, lint**

Run: `pnpm --filter @repo/api build`, `pnpm --filter @repo/api test`, `pnpm --filter @repo/api lint`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/search apps/api/src/modules/boards/repositories/boards.repository.ts apps/api/src/modules/tasks/repositories/tasks.repository.ts
git commit -m "perf(search): use Postgres full-text search for boards and tasks"
```

---

### Task 5: Notification Preferences API + Email Delivery

**Files:**
- Modify: `apps/api/src/modules/auth/auth.module.ts` (export `UserRepository`, `MAIL_PROVIDER`)
- Create: `apps/api/src/modules/notifications/repositories/notification-preferences.repository.ts`
- Create: `apps/api/src/modules/notifications/services/notification-preferences.service.ts`
- Create: `apps/api/src/modules/notifications/controllers/notification-preferences.controller.ts`
- Modify: `apps/api/src/modules/notifications/notifications.module.ts` (import `AuthModule`, add providers/controllers)
- Modify: `apps/api/src/modules/notifications/handlers/notification.handler.ts` (email on invite + assignment)
- Create: `apps/api/src/modules/notifications/services/notification-preferences.service.spec.ts`
- Create: `apps/api/src/modules/notifications/controllers/notification-preferences.controller.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`notification_preferences` table), `MAIL_PROVIDER` token + `MailMessage`/`MailSendResult` from `apps/api/src/modules/auth/mail/mail.provider.ts`, `AuthModule` exports.
- Produces:
  - `GET /v1/users/me/notification-preferences` → `{ preferences: NotificationPreferenceDto[] }`
  - `PUT /v1/users/me/notification-preferences` body `{ preferences: Array<{ type: string; emailEnabled: boolean; inAppEnabled: boolean }> }` → `{ preferences: [...] }`
  - All 10 enum types always returned (missing rows synthesized as defaults).

**Steps:**

- [ ] **Step 1: Export beyond AuthModule**

In `apps/api/src/modules/auth/auth.module.ts`, add `UserRepository`, `MAIL_PROVIDER`, and `TokenService` to the `exports` array (`TokenService` is injected by the Admin module later):

```ts
exports: [
  AuthService,
  JwtAuthGuard,
  AuthEventBus,
  UserRepository,
  MAIL_PROVIDER,
  TokenService,
],
```

- [ ] **Step 2: Create the preferences repository**

`apps/api/src/modules/notifications/repositories/notification-preferences.repository.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  inArray,
  type Db,
  type NotificationPreferenceRow,
  notificationPreferences,
  type NotificationType,
} from '@repo/database';

@Injectable()
export class NotificationPreferencesRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async listByUser(
    userId: string,
  ): Promise<NotificationPreferenceRow[]> {
    return this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
  }

  public async findByUserAndType(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreferenceRow | undefined> {
    const [row] = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, type),
        ),
      )
      .limit(1);
    return row;
  }

  public async upsert(
    userId: string,
    entries: Array<{
      type: NotificationType;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>,
  ): Promise<void> {
    if (entries.length === 0) return;
    await this.db
      .insert(notificationPreferences)
      .values(
        entries.map((e) => ({
          userId,
          type: e.type,
          emailEnabled: e.emailEnabled,
          inAppEnabled: e.inAppEnabled,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [notificationPreferences.userId, notificationPreferences.type],
        set: {
          emailEnabled: sql`excluded.email_enabled`,
          inAppEnabled: sql`excluded.in_app_enabled`,
          updatedAt: sql`now()`,
        },
      });
  }
}
```

Import `sql` from `drizzle-orm` in this file (add to the `@repo/database` imports or import from `drizzle-orm` directly — match the repository files' convention; `audit.repository.ts` imports `sql` from `drizzle-orm`).

- [ ] **Step 3: Create the preferences service**

`apps/api/src/modules/notifications/services/notification-preferences.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import { notificationTypeEnum, type NotificationType } from '@repo/database';

import { NotificationPreferencesRepository } from '../repositories/notification-preferences.repository';

const ALL_TYPES = notificationTypeEnum.enumValues;

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @Inject(NotificationPreferencesRepository)
    private readonly repo: NotificationPreferencesRepository,
  ) {}

  public async getAll(userId: string): Promise<
    Array<{
      type: NotificationType;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>
  > {
    const rows = await this.repo.listByUser(userId);
    const byType = new Map(rows.map((r) => [r.type, r]));
    return ALL_TYPES.map((type) => {
      const row = byType.get(type);
      return {
        type,
        emailEnabled: row ? row.emailEnabled : true,
        inAppEnabled: row ? row.inAppEnabled : true,
      };
    });
  }

  public async upsert(
    userId: string,
    entries: Array<{
      type: NotificationType;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }>,
  ): Promise<void> {
    const known = new Set<string>(ALL_TYPES);
    const valid = entries.filter((e) => known.has(e.type));
    await this.repo.upsert(userId, valid);
  }

  public async isEmailEnabled(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const row = await this.repo.findByUserAndType(userId, type);
    return row ? row.emailEnabled : true;
  }
}
```

- [ ] **Step 4: Create the controller**

`apps/api/src/modules/notifications/controllers/notification-preferences.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { NotificationPreferencesService } from '../services/notification-preferences.service';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller({ path: 'users/me', version: '1' })
export class NotificationPreferencesController {
  constructor(
    @Inject(NotificationPreferencesService)
    private readonly preferences: NotificationPreferencesService,
  ) {}

  @Get('notification-preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get my notification preferences (all types)' })
  public async get(
    @CurrentUser() user: CurrentUserModel,
  ): Promise<{ preferences: Array<{ type: string; emailEnabled: boolean; inAppEnabled: boolean }> }> {
    const preferences = await this.preferences.getAll(user.id);
    return { preferences };
  }

  @Put('notification-preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my notification preferences' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        preferences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              emailEnabled: { type: 'boolean' },
              inAppEnabled: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  public async update(
    @CurrentUser() user: CurrentUserModel,
    @Body() body: { preferences?: Array<{ type: string; emailEnabled: boolean; inAppEnabled: boolean }> },
  ): Promise<{ preferences: Array<{ type: string; emailEnabled: boolean; inAppEnabled: boolean }> }> {
    const entries = (body?.preferences ?? []).filter(
      (p) => p && typeof p.type === 'string' && typeof p.emailEnabled === 'boolean' && typeof p.inAppEnabled === 'boolean',
    );
    await this.preferences.upsert(
      user.id,
      entries.map((p) => ({
        type: p.type as NotificationType,
        emailEnabled: p.emailEnabled,
        inAppEnabled: p.inAppEnabled,
      })),
    );
    const preferences = await this.preferences.getAll(user.id);
    return { preferences };
  }
}
```

Import `type NotificationType` from `@repo/database` in the controller.

- [ ] **Step 5: Add email delivery to NotificationHandler**

`apps/api/src/modules/notifications/handlers/notification.handler.ts`:

1. Register `onInvitationCreated` in `onModuleInit`:

```ts
this.workspacesEventBus.onInvitationCreated((p) => {
  void this.handleInvitationCreated(p);
});
```

2. Add injections: `UserRepository` (from `../../auth/repositories/user.repository`), `NotificationPreferencesService`, and the mail provider:

```ts
@Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
@Inject(UserRepository) private readonly usersRepo: UserRepository,
@Inject(NotificationPreferencesService)
private readonly preferences: NotificationPreferencesService,
```

(`MAIL_PROVIDER` + `MailProvider` type import from `../../auth/mail/mail.provider`.)

3. Add the handler (fires only when the invitee already has an account; respects the `MEMBER_ADDED` email pref):

```ts
private async handleInvitationCreated(
  payload: InvitationCreatedPayload,
): Promise<void> {
  try {
    const target = await this.usersRepo.findByEmail(payload.email);
    if (!target) return;
    const emailEnabled = await this.preferences.isEmailEnabled(
      target.id,
      'MEMBER_ADDED',
    );
    if (!emailEnabled) return;
    await this.mailProvider.send({
      to: target.email,
      subject: 'You were invited to a workspace',
      text: 'Open your dashboard to accept the invitation.',
    });
  } catch (err) {
    this.logger.error('Failed to send invitation email', err);
  }
}
```

`InvitationCreatedPayload` is `{ workspaceId, email, invitedById }` — no display name field, so use the generic subject above. Import the type from the workspaces events file.

4. In `handleTaskCreated`, after the in-app delivery, add email delivery to the assignee gated on the `TASK_ASSIGNED` pref:

```ts
if (!payload.assigneeId || payload.assigneeId === payload.createdBy) return;
try {
  await this.notifications.createAndDeliver(payload.assigneeId, {
    type: 'TASK_ASSIGNED',
    title: 'You were assigned a task',
    body: payload.title,
    resourceType: 'task',
    resourceId: payload.taskId,
  });

  const emailEnabled = await this.preferences.isEmailEnabled(
    payload.assigneeId,
    'TASK_ASSIGNED',
  );
  if (emailEnabled) {
    const assignee = await this.usersRepo.findById(payload.assigneeId);
    if (assignee) {
      await this.mailProvider.send({
        to: assignee.email,
        subject: 'You were assigned a task',
        text: payload.title,
      });
    }
  }
} catch (err) {
  this.logger.error('Failed to handle TaskCreated', err);
}
```

- [ ] **Step 6: Wire NotificationsModule**

Add `AuthModule` to imports and register the new providers/controllers:

```ts
imports: [
  AuthModule,
  BoardsModule,
  TasksModule,
  CommentsModule,
  WorkspacesModule,
  UploadsModule,
],
controllers: [
  NotificationsController,
  NotificationPreferencesController,
],
providers: [
  ...,
  NotificationPreferencesService,
  NotificationPreferencesRepository,
],
```

Remove the now-redundant direct `BoardsRepository`/`WorkspaceMembersRepository` provider entries only if `AuthModule` importing doesn't cover them — it does not; **keep** them as-is. Add `NotificationPreferencesRepository` + `NotificationPreferencesService`.

- [ ] **Step 7: Write service + controller specs**

`notification-preferences.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferencesRepository } from '../repositories/notification-preferences.repository';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let repo: { listByUser: jest.Mock; findByUserAndType: jest.Mock; upsert: jest.Mock };

  beforeEach(async () => {
    repo = {
      listByUser: jest.fn(),
      findByUserAndType: jest.fn(),
      upsert: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: NotificationPreferencesRepository, useValue: repo },
      ],
    }).compile();
    service = module.get(NotificationPreferencesService);
  });

  it('returns all notification types, defaulting missing rows to enabled', async () => {
    repo.listByUser.mockResolvedValue([
      { userId: 'u-1', type: 'TASK_ASSIGNED', emailEnabled: false, inAppEnabled: true },
    ]);
    const all = await service.getAll('u-1');
    expect(all).toHaveLength(10);
    const assigned = all.find((p) => p.type === 'TASK_ASSIGNED');
    expect(assigned).toEqual({ type: 'TASK_ASSIGNED', emailEnabled: false, inAppEnabled: true });
    const comment = all.find((p) => p.type === 'COMMENT_ADDED');
    expect(comment).toEqual({ type: 'COMMENT_ADDED', emailEnabled: true, inAppEnabled: true });
  });

  it('isEmailEnabled uses the stored row when present and defaults to true otherwise', async () => {
    repo.findByUserAndType.mockResolvedValue({ emailEnabled: false });
    await expect(service.isEmailEnabled('u-1', 'TASK_ASSIGNED')).resolves.toBe(false);
    repo.findByUserAndType.mockResolvedValue(undefined);
    await expect(service.isEmailEnabled('u-1', 'TASK_ASSIGNED')).resolves.toBe(true);
  });

  it('upsert filters unknown types', async () => {
    await service.upsert('u-1', [
      { type: 'TASK_ASSIGNED' as any, emailEnabled: true, inAppEnabled: false },
      { type: 'NOT_A_TYPE' as any, emailEnabled: true, inAppEnabled: true },
    ]);
    expect(repo.upsert).toHaveBeenCalledWith('u-1', [
      { type: 'TASK_ASSIGNED', emailEnabled: true, inAppEnabled: false },
    ]);
  });
});
```

`notification-preferences.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from '../services/notification-preferences.service';

describe('NotificationPreferencesController', () => {
  let controller: NotificationPreferencesController;
  let service: { getAll: jest.Mock; upsert: jest.Mock };

  beforeEach(async () => {
    service = { getAll: jest.fn(), upsert: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        { provide: NotificationPreferencesService, useValue: service },
      ],
    }).compile();
    controller = module.get(NotificationPreferencesController);
  });

  it('GET returns preferences for the calling user', async () => {
    service.getAll.mockResolvedValue([{ type: 'COMMENT_ADDED', emailEnabled: true, inAppEnabled: true }]);
    const currentUser = { id: 'u-1' } as any;
    const res = await controller.get(currentUser);
    expect(service.getAll).toHaveBeenCalledWith('u-1');
    expect(res.preferences).toHaveLength(1);
  });

  it('PUT upserts only well-formed entries, then returns merged prefs', async () => {
    service.upsert.mockResolvedValue(undefined);
    service.getAll.mockResolvedValue([{ type: 'TASK_ASSIGNED', emailEnabled: true, inAppEnabled: true }]);
    const currentUser = { id: 'u-1' } as any;
    const res = await controller.update(currentUser, {
      preferences: [
        { type: 'TASK_ASSIGNED', emailEnabled: true, inAppEnabled: true },
        { type: 'BOGUS' },
      ],
    });
    expect(service.upsert).toHaveBeenCalledWith('u-1', [
      { type: 'TASK_ASSIGNED', emailEnabled: true, inAppEnabled: true },
    ]);
    expect(service.getAll).toHaveBeenCalledWith('u-1');
    expect(res.preferences).toHaveLength(1);
  });

  it('PUT tolerates an undefined body', async () => {
    service.getAll.mockResolvedValue([]);
    const currentUser = { id: 'u-1' } as any;
    await expect(controller.update(currentUser, undefined as any)).resolves.toEqual({ preferences: [] });
    expect(service.upsert).toHaveBeenCalledWith('u-1', []);
  });
});
```

- [ ] **Step 8: Build, test, lint**

Run: `pnpm --filter @repo/api build`, `pnpm --filter @repo/api test`, `pnpm --filter @repo/api lint`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/modules/notifications
git commit -m "feat(notifications): add preference endpoints and email delivery"
```

---

### Task 6: Active Workspace Persistence + Sidebar Fixes

**Files:**
- Create: `apps/web/lib/active-workspace.ts`
- Modify: `apps/web/components/sidebar.tsx` (persist active id; "All workspaces" → `/dashboard`)
- Modify: `apps/web/contexts/auth-context.tsx` (login/register routing)

**Interfaces:**
- Consumes: `useAuth` (`user`), `workspacesApi.list()`.
- Produces:
  - `getLastActiveWorkspace(userId: string): string | null`
  - `setLastActiveWorkspace(userId: string, workspaceId: string): void`

**Steps:**

- [ ] **Step 1: Create the persistence helper**

`apps/web/lib/active-workspace.ts`:

```ts
const KEY_PREFIX = 'lastActiveWorkspace:';

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function getLastActiveWorkspace(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(keyFor(userId));
  } catch {
    return null;
  }
}

export function setLastActiveWorkspace(
  userId: string,
  workspaceId: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(keyFor(userId), workspaceId);
  } catch {
    // storage unavailable (private mode etc.) — persistence is best-effort
  }
}
```

- [ ] **Step 2: Persist from the sidebar**

In `apps/web/components/sidebar.tsx`, the effect that syncs `activeWorkspaceId` from the pathname also persists it. `user` is now in the deps:

```ts
useEffect(() => {
  const match = pathname.match(/^\/workspaces\/([^/]+)/);
  if (match && match[1]) {
    setActiveWorkspaceId(match[1]);
    if (user) {
      setLastActiveWorkspace(user.id, match[1]);
    }
  }
}, [pathname, user]);
```

Add the import: `import { setLastActiveWorkspace } from '@/lib/active-workspace';`

Change the "All workspaces" link at the bottom of the switcher from `href="/workspaces"` to `href="/dashboard"`.

- [ ] **Step 3: Route login/register intelligently**

In `apps/web/contexts/auth-context.tsx`:

1. Import `workspacesApi` from `@/lib/workspaces` and `getLastActiveWorkspace` from `@/lib/active-workspace`.

2. Extract a shared resolver:

```ts
async function resolveLandingRoute(): Promise<string> {
  try {
    const workspaces = await workspacesApi.list();
    if (workspaces.length === 0) return '/onboarding';
    const userId = getStoredUser()?.id ?? '';
    const lastActive = userId ? getLastActiveWorkspace(userId) : null;
    const target =
      lastActive && workspaces.some((w) => w.id === lastActive)
        ? lastActive
        : workspaces[0]!.id;
    return `/workspaces/${target}`;
  } catch {
    return '/dashboard';
  }
}
```

(`getStoredUser` is already imported in this file.)

3. Update `login`:

```ts
const login = useCallback(
  async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setUser(res.user);
    storeUser(res.user);
    router.push(await resolveLandingRoute());
  },
  [router],
);
```

4. Update `register` to always onboard:

```ts
const register = useCallback(
  async (email: string, password: string, name: string) => {
    const res = await apiRegister(email, password, name);
    setUser(res.user);
    storeUser(res.user);
    router.push('/onboarding');
  },
  [router],
);
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm --filter @repo/web check-types` and `pnpm --filter @repo/web lint`.
Expected: clean (no build needed for a client-side-only change, but run `pnpm --filter @repo/web build` if CI requires it).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/active-workspace.ts apps/web/components/sidebar.tsx apps/web/contexts/auth-context.tsx
git commit -m "feat(web): persist last active workspace and route after login"
```

---

### Task 7: Notification Preferences UI

**Files:**
- Modify: `apps/web/app/settings/_components/preferences-tab.tsx`
- Create: `apps/web/lib/notification-preferences.ts`

**Interfaces:**
- Consumes: Task 5 API.
- Produces: `notificationPreferencesApi.get()` / `.update(entries)` used by the tab.

**Steps:**

- [ ] **Step 1: Create the API helper**

`apps/web/lib/notification-preferences.ts`:

```ts
import { api } from './api';

export type NotificationPreference = {
  type: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  COMMENT_ADDED: 'Someone comments on a board you are in',
  BOARD_SHARED: 'A board is shared with you',
  WORKSPACE_UPDATED: 'Your workspace is updated',
  MENTION_CREATED: 'You are mentioned',
  MEMBER_ADDED: 'You are added to a workspace',
  INVITATION_ACCEPTED: 'Someone accepts your invitation',
  TASK_ASSIGNED: 'You are assigned a task',
  TASK_UNASSIGNED: 'You are unassigned from a task',
  TASK_DELETED: 'A task you were assigned is deleted',
  FILE_UPLOADED: 'A file is uploaded to your board',
};

export const notificationPreferencesApi = {
  get: () =>
    api.get<{ preferences: NotificationPreference[] }>(
      '/users/me/notification-preferences',
    ),
  update: (preferences: NotificationPreference[]) =>
    api.put<{ preferences: NotificationPreference[] }>(
      '/users/me/notification-preferences',
      { preferences },
    ),
};
```

- [ ] **Step 2: Add the notifications section to PreferencesTab**

In `apps/web/app/settings/_components/preferences-tab.tsx`:

1. Import the helper and add state:

```ts
import {
  notificationPreferencesApi,
  NOTIFICATION_TYPE_LABELS,
  type NotificationPreference,
} from '@/lib/notification-preferences';
import { Bell } from 'lucide-react';

const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference[]>([]);
const [prefsLoaded, setPrefsLoaded] = useState(false);
```

2. In the existing `useEffect` that loads `/auth/me`, add a parallel fetch (or a second effect):

```ts
useEffect(() => {
  notificationPreferencesApi
    .get()
    .then((res) => {
      setNotificationPrefs(res.preferences);
      setPrefsLoaded(true);
    })
    .catch(() => {
      setPrefsLoaded(true);
    });
}, []);
```

3. Add a toggle updater:

```ts
function togglePref(type: string, key: 'emailEnabled' | 'inAppEnabled') {
  setNotificationPrefs((prev) =>
    prev.map((p) => (p.type === type ? { ...p, [key]: !p[key] } : p)),
  );
}
```

4. Extend `handleSave` to also PUT the preferences (after the existing `/users/me` PATCH):

```ts
await notificationPreferencesApi.update(notificationPrefs);
```

5. Render, inside the form after the locale selector and before the save row:

```tsx
<div className="rounded-xl border border-surface-800 p-4">
  <div className="mb-3 flex items-center gap-2">
    <Bell size={15} className="text-primary-400" />
    <h3 className="text-sm font-medium text-surface-200">Notifications</h3>
  </div>
  {!prefsLoaded ? (
    <div className="py-6 text-center text-xs text-surface-500">Loading…</div>
  ) : (
    <div className="space-y-4">
      {notificationPrefs.map((p) => (
        <div
          key={p.type}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-sm text-surface-300">
            {NOTIFICATION_TYPE_LABELS[p.type] ?? p.type}
          </span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-surface-500">
              <input
                type="checkbox"
                checked={p.emailEnabled}
                onChange={() => togglePref(p.type, 'emailEnabled')}
                disabled={p.type === 'MENTION_CREATED'}
                className="accent-primary-500"
              />
              Email
            </label>
            <label className="flex items-center gap-1.5 text-xs text-surface-500">
              <input
                type="checkbox"
                checked={p.inAppEnabled}
                onChange={() => togglePref(p.type, 'inAppEnabled')}
                className="accent-primary-500"
              />
              In-app
            </label>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

The `MENTION_CREATED` row is rendered but its toggles are disabled (inert, per spec: no mention feature ships).

- [ ] **Step 3: Typecheck + lint + build**

Run: `pnpm --filter @repo/web check-types`, `pnpm --filter @repo/web lint`, `pnpm --filter @repo/web build`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/notification-preferences.ts apps/web/app/settings/_components/preferences-tab.tsx
git commit -m "feat(web): notification preference toggles in settings"
```

---

### Task 8: Platform Admin Role + Guard + Token Claims

**Files:**
- Modify: `packages/database` is done in Task 1 (`users.isAdmin`).
- Modify: `apps/api/src/modules/auth/interfaces/current-user.interface.ts` (add `isAdmin`)
- Modify: `apps/api/src/modules/auth/interfaces/jwt-payload.interface.ts` (add `impersonatorId?`)
- Modify: `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` (populate `isAdmin`)
- Modify: `apps/api/src/modules/auth/services/token.service.ts` (accept + embed `impersonatorId`)
- Modify: `apps/api/src/modules/auth/services/auth.service.ts` (mint role from `user.isAdmin`)
- Modify: `apps/api/src/modules/auth/errors/auth.errors.ts` (`FORBIDDEN` code + 403 mapping)
- Create: `apps/api/src/modules/auth/guards/admin.guard.ts`
- Modify: `apps/api/src/modules/auth/dto/auth-response.dto.ts` (`UserProfileDto.isAdmin`)
- Modify: `apps/api/src/modules/auth/controllers/auth.controller.ts` (map `isAdmin`)
- Modify: `apps/api/src/modules/users/dto/user-response.dto.ts` (`UserProfileDto.isAdmin`)
- Modify: `apps/api/src/modules/users/controllers/users.controller.ts` (map `isAdmin`)
- Modify: `apps/web/lib/auth.ts` (User type gains `isAdmin`)

**Interfaces:**
- Consumes: Task 1 (`UserRow.isAdmin`).
- Produces:
  - `CurrentUser.isAdmin: boolean` — true when the request user is a platform admin.
  - `AdminGuard` (exported from AuthModule) — `canActivate` rejects non-admins with `403 AUTH.FORBIDDEN`.
  - `AccessTokenPayload.impersonatorId?: string` — set only on impersonation tokens.
  - `AuthService`/`TokenService` mint `role: 'ADMIN' | 'USER'` from the DB flag.

**Steps:**

- [ ] **Step 1: Add FORBIDDEN to auth errors**

`apps/api/src/modules/auth/errors/auth.errors.ts`:

```ts
FORBIDDEN: 'AUTH.FORBIDDEN',
```

And in `STATUS_BY_CODE` add `[AuthErrorCode.FORBIDDEN]: 403`. Read the existing `STATUS_BY_CODE` record and add the entry in the same style.

- [ ] **Step 2: Extend CurrentUser**

`apps/api/src/modules/auth/interfaces/current-user.interface.ts`:

```ts
export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  isAdmin: boolean;
}
```

- [ ] **Step 3: Populate isAdmin in the guard**

In `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`, the `current` object:

```ts
const current: CurrentUser = {
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  status: user.status,
  emailVerifiedAt: user.emailVerifiedAt,
  isAdmin: user.isAdmin,
};
```

- [ ] **Step 4: Support impersonatorId in tokens**

`apps/api/src/modules/auth/interfaces/jwt-payload.interface.ts` — add to `AccessTokenPayload`:

```ts
/** Set only when an admin is acting on behalf of another user. */
impersonatorId?: string;
```

`apps/api/src/modules/auth/services/token.service.ts` — widen `signAccessToken`:

```ts
public async signAccessToken(payload: {
  sub: string;
  role?: 'USER' | 'ADMIN';
  impersonatorId?: string;
}): Promise<{ token: string; expiresInSeconds: number }> {
  const body: AccessTokenPayload = {
    v: JWT_ACCESS_PAYLOAD_VERSION,
    sub: payload.sub,
    role: payload.role ?? 'USER',
    impersonatorId: payload.impersonatorId,
  };
  const token = await new SignJWT({
    v: body.v,
    role: body.role,
    impersonatorId: body.impersonatorId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(body.sub)
    .setIssuedAt()
    .setExpirationTime(`${this.accessTtl}s`)
    .sign(this.accessSecret);

  return { token, expiresInSeconds: this.accessTtl };
}
```

- [ ] **Step 5: Mint role from the DB flag**

In `apps/api/src/modules/auth/services/auth.service.ts`, `sessionTokensFor`:

```ts
const access = await this.tokens.signAccessToken({
  sub: user.id,
  role: user.isAdmin ? 'ADMIN' : 'USER',
});
```

- [ ] **Step 6: Create AdminGuard**

`apps/api/src/modules/auth/guards/admin.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AuthErrorCode, AuthException } from '../errors/auth.errors';
import type { CurrentUser } from '../interfaces/current-user.interface';

/**
 * Platform-admin gate. `request.user` is repopulated from the database
 * on every request by `JwtAuthGuard`, so `isAdmin` here reflects current
 * DB state — never just the token's `role` claim.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: CurrentUser;
    }>();
    const user = request.user;
    if (!user?.isAdmin) {
      throw new AuthException(
        AuthErrorCode.FORBIDDEN,
        'Admin access only.',
      );
    }
    return true;
  }
}
```

- [ ] **Step 7: Export AdminGuard from AuthModule**

Add `AdminGuard` to AuthModule `providers` and `exports`.

- [ ] **Step 8: Surface isAdmin in DTOs**

`apps/api/src/modules/auth/dto/auth-response.dto.ts` — add to `UserProfileDto`:

```ts
@ApiProperty({ example: false })
isAdmin!: boolean;
```

`apps/api/src/modules/auth/controllers/auth.controller.ts` — in `toAuthResponse`, add `isAdmin: result.user.isAdmin`; find any other `user:` literal mapping there and add it. Check whether `getMe` reuses `toAuthResponse` or a separate mapper and add `isAdmin` there too.

`apps/api/src/modules/users/dto/user-response.dto.ts` — add `isAdmin!: boolean;` to `UserProfileDto`.

`apps/api/src/modules/users/controllers/users.controller.ts` — in `toUserProfile`, add `isAdmin: row.isAdmin`; widen the parameter type if needed (`isAdmin` flows from `PUBLIC_USER_COLUMNS`-style rows — include `isAdmin` in the mapped object; if the row type lacks it, select it explicitly).

- [ ] **Step 9: Add isAdmin to the web User type + persist on profile refresh**

`apps/web/lib/auth.ts`:

```ts
export type User = {
  ...
  isAdmin: boolean;
  ...
};
```

Verify `/auth/me` responses now include `isAdmin` (Task's Step 8 makes the API return it) and the stored user round-trips.

- [ ] **Step 10: Build + test + lint**

Run: `pnpm --filter @repo/api build`, `pnpm --filter @repo/api test`, `pnpm --filter @repo/api lint`, then `pnpm --filter @repo/web check-types`.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/modules/users apps/web/lib/auth.ts
git commit -m "feat(auth): platform admin role, guard, and token claims"
```

---

### Task 9: Admin Module (Lookups, Subscription Stub, Impersonation)

**Files:**
- Create: `apps/api/src/modules/admin/admin.constants.ts` (optional)
- Create: `apps/api/src/modules/admin/data/admin.repository.ts`
- Create: `apps/api/src/modules/admin/data/admin-audit.repository.ts`
- Create: `apps/api/src/modules/admin/services/admin.service.ts`
- Create: `apps/api/src/modules/admin/controllers/admin.controller.ts`
- Create: `apps/api/src/modules/admin/admin.module.ts`
- Create: `apps/api/src/modules/admin/services/admin.service.spec.ts`
- Create: `apps/api/src/modules/admin/controllers/admin.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `AdminModule`)

**Interfaces:**
- Consumes: Task 8 (`AdminGuard`, `CurrentUser.isAdmin`), Task 1 (`admin_audit_log`, `users.isAdmin`).
- Produces (under `apps/api/src/modules/admin/`):
  - `AdminRepository.lookupUsers(query: string, limit?: number)` / `findUserById(id)`
  - `AdminRepository.lookupWorkspaces(query: string, limit?: number)` / `findWorkspaceById(id)`
  - `AdminAuditRepository.record(actorId, action, targetType, targetId, metadata?)`
  - `AdminService.impersonate(actorId, targetId)` returns `{ token, expiresInSeconds, user }`
  - Routes (all behind `@UseGuards(AdminGuard)`, controller path `admin`, version `1`):
    - `GET /v1/admin/users?query=`
    - `GET /v1/admin/users/:id`
    - `GET /v1/admin/workspaces?query=`
    - `GET /v1/admin/workspaces/:id`
    - `GET /v1/admin/users/:id/subscription` (stub)
    - `POST /v1/admin/users/:id/impersonate`

**Steps:**

- [ ] **Step 1: Create AdminRepository**

`apps/api/src/modules/admin/data/admin.repository.ts` — direct Drizzle reads (self-contained, avoids cross-module repo exposure):

```ts
import { Inject, Injectable } from '@nestjs/common';

import {
  and,
  DATABASE,
  eq,
  or,
  sql,
  type Db,
  type UserRow,
  users,
  type WorkspaceRow,
  workspaces,
} from '@repo/database';

@Injectable()
export class AdminRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async findUserById(id: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), sql`${users.deletedAt} IS NULL`))
      .limit(1);
    return row;
  }

  public async lookupUsers(
    query: string,
    limit = 20,
  ): Promise<UserRow[]> {
    const like = `%${query.toLowerCase()}%`;
    return this.db
      .select()
      .from(users)
      .where(
        and(
          sql`${users.deletedAt} IS NULL`,
          or(
            sql`lower(${users.email}) LIKE ${like}`,
            sql`lower(${users.displayName}) LIKE ${like}`,
          ),
        ),
      )
      .limit(limit);
  }

  public async findWorkspaceById(id: string): Promise<WorkspaceRow | undefined> {
    const [row] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return row;
  }

  public async lookupWorkspaces(
    query: string,
    limit = 20,
  ): Promise<WorkspaceRow[]> {
    const like = `%${query.toLowerCase()}%`;
    return this.db
      .select()
      .from(workspaces)
      .where(
        or(
          sql`lower(${workspaces.name}) LIKE ${like}`,
          sql`lower(${workspaces.slug}) LIKE ${like}`,
        ),
      )
      .limit(limit);
  }
}
```

- [ ] **Step 2: Create AdminAuditRepository**

`apps/api/src/modules/admin/data/admin-audit.repository.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, type Db, adminAuditLog } from '@repo/database';

@Injectable()
export class AdminAuditRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  public async record(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db.insert(adminAuditLog).values({
      actorId,
      action,
      targetType,
      targetId,
      metadata,
    });
  }
}
```

(Verify the `adminAuditLog` export path — it re-exports from `packages/database` schema index, so `import { adminAuditLog } from '@repo/database'` works.)

- [ ] **Step 3: Create AdminService**

`apps/api/src/modules/admin/services/admin.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';

import { AuthErrorCode, AuthException } from '../../auth/errors/auth.errors';
import { TokenService } from '../../auth/services/token.service';

import { AdminAuditRepository } from '../data/admin-audit.repository';
import { AdminRepository } from '../data/admin.repository';

@Injectable()
export class AdminService {
  constructor(
    @Inject(AdminRepository) private readonly adminRepo: AdminRepository,
    @Inject(AdminAuditRepository)
    private readonly adminAuditRepo: AdminAuditRepository,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  static readonly STUB_SUBSCRIPTION = {
    plan: 'free',
    status: 'active',
    note: 'stubbed — billed in Phase 3',
  } as const;

  public async impersonate(actorId: string, targetId: string) {
    if (actorId === targetId) {
      throw new AuthException(
        AuthErrorCode.FORBIDDEN,
        'Cannot impersonate yourself.',
      );
    }

    const target = await this.adminRepo.findUserById(targetId);
    if (!target) {
      throw new AuthException(
        AuthErrorCode.UNAUTHENTICATED,
        'Target user not found.',
      );
    }
    if (target.isAdmin) {
      throw new AuthException(
        AuthErrorCode.FORBIDDEN,
        'Cannot impersonate another admin.',
      );
    }
    if (target.status !== 'ACTIVE') {
      throw new AuthException(
        AuthErrorCode.FORBIDDEN,
        'Cannot impersonate an inactive account.',
      );
    }

    await this.adminAuditRepo.record(
      actorId,
      'user.impersonated',
      'user',
      targetId,
      { impersonatorId: actorId },
    );

    const token = await this.tokens.signAccessToken({
      sub: target.id,
      role: target.isAdmin ? 'ADMIN' : 'USER',
      impersonatorId: actorId,
    });

    return {
      token: token.token,
      expiresInSeconds: token.expiresInSeconds,
      user: {
        id: target.id,
        email: target.email,
        displayName: target.displayName,
        status: target.status,
        isAdmin: target.isAdmin,
      },
    };
  }
}
```

- [ ] **Step 4: Create AdminController**

`apps/api/src/modules/admin/controllers/admin.controller.ts` — thin controller behind `@UseGuards(AdminGuard)`:

```ts
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../../auth/guards/admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserModel } from '../../auth/interfaces/current-user.interface';

import { AdminService } from '../services/admin.service';
import { AdminRepository } from '../data/admin.repository';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(AdminRepository) private readonly adminRepo: AdminRepository,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Look up users (email or id) — internal tool' })
  @ApiQuery({ name: 'query', required: true })
  public async getUsers(@Query('query') query: string) {
    return this.adminRepo.lookupUsers((query ?? '').trim(), 20);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Look up a single user' })
  public async getUserById(@Param('id') id: string) {
    return this.adminRepo.findUserById(id);
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'Look up workspaces (name or slug)' })
  @ApiQuery({ name: 'query', required: true })
  public async getWorkspaces(@Query('query') query: string) {
    return this.adminRepo.lookupWorkspaces((query ?? '').trim(), 20);
  }

  @Get('workspaces/:id')
  @ApiOperation({ summary: 'Look up a single workspace' })
  public async getWorkspaceById(@Param('id') id: string) {
    return this.adminRepo.findWorkspaceById(id);
  }

  @Get('users/:id/subscription')
  @ApiOperation({ summary: 'Get a user subscription (stubbed until Phase 3)' })
  public getSubscription(@Param('id') _id: string) {
    return AdminService.STUB_SUBSCRIPTION;
  }

  @Post('users/:id/impersonate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in as another user (audit-logged)' })
  public async impersonate(
    @CurrentUser() actor: CurrentUserModel,
    @Param('id') id: string,
  ) {
    return this.admin.impersonate(actor.id, id);
  }
}
```

- [ ] **Step 5: Create AdminModule and register it**

`apps/api/src/modules/admin/admin.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { AdminAuditRepository } from './data/admin-audit.repository';
import { AdminRepository } from './data/admin.repository';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, AdminAuditRepository],
})
export class AdminModule {}
```

In `apps/api/src/app.module.ts`, add `AdminModule` to the imports list (after `AuditModule`).

- [ ] **Step 6: Write specs**

`admin.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthErrorCode, AuthException } from '../../auth/errors/auth.errors';
import { TokenService } from '../../auth/services/token.service';
import { AdminAuditRepository } from '../data/admin-audit.repository';
import { AdminRepository } from '../data/admin.repository';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let adminRepo: { findUserById: jest.Mock; lookupUsers: jest.Mock; lookupWorkspaces: jest.Mock; findWorkspaceById: jest.Mock };
  let auditRepo: { record: jest.Mock };
  let tokens: { signAccessToken: jest.Mock };

  beforeEach(async () => {
    adminRepo = {
      findUserById: jest.fn(),
      lookupUsers: jest.fn(),
      lookupWorkspaces: jest.fn(),
      findWorkspaceById: jest.fn(),
    };
    auditRepo = { record: jest.fn().mockResolvedValue(undefined) };
    tokens = { signAccessToken: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AdminRepository, useValue: adminRepo },
        { provide: AdminAuditRepository, useValue: auditRepo },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  it('rejects impersonating yourself', async () => {
    await expect(service.impersonate('u-1', 'u-1')).rejects.toMatchObject({
      code: AuthErrorCode.FORBIDDEN,
    });
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('rejects impersonating another admin', async () => {
    adminRepo.findUserById.mockResolvedValue({ id: 'u-2', isAdmin: true, status: 'ACTIVE' });
    await expect(service.impersonate('u-1', 'u-2')).rejects.toMatchObject({
      code: AuthErrorCode.FORBIDDEN,
    });
  });

  it('rejects impersonating a non-active user', async () => {
    adminRepo.findUserById.mockResolvedValue({ id: 'u-2', isAdmin: false, status: 'SUSPENDED' });
    await expect(service.impersonate('u-1', 'u-2')).rejects.toMatchObject({
      code: AuthErrorCode.FORBIDDEN,
    });
  });

  it('audits the impersonation before issuing the token', async () => {
    adminRepo.findUserById.mockResolvedValue({ id: 'u-2', email: 'u@x.io', displayName: 'U', status: 'ACTIVE', isAdmin: false });
    tokens.signAccessToken.mockResolvedValue({ token: 'tkn', expiresInSeconds: 3600 });

    const res = await service.impersonate('u-1', 'u-2');

    expect(auditRepo.record).toHaveBeenCalledWith('u-1', 'user.impersonated', 'user', 'u-2', { impersonatorId: 'u-1' });
    expect(tokens.signAccessToken).toHaveBeenCalledWith({ sub: 'u-2', role: 'USER', impersonatorId: 'u-1' });
    expect(res.token).toBe('tkn');
  });
});
```

`admin.controller.spec.ts`: build the module with `AdminGuard` overridden to `{ canActivate: () => true }` and the service/repos mocked; assert `GET /users` returns `adminRepo.lookupUsers(...)` output and `POST /users/:id/impersonate` calls `service.impersonate(actor.id, id)`.

- [ ] **Step 7: Build, test, lint**

Run: `pnpm --filter @repo/api build`, `pnpm --filter @repo/api test`, `pnpm --filter @repo/api lint`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/admin apps/api/src/app.module.ts
git commit -m "feat(admin): user and workspace lookup, subscription stub, impersonation"
```

---

### Task 10: Onboarding Flow UI

**Files:**
- Create: `apps/web/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `workspacesApi.create/list`, `boardsApi.create`, `setLastActiveWorkspace` (Task 6).
- Produces: `/onboarding` route. Redirects to `/dashboard` if the user already has workspaces.

**Steps:**

- [ ] **Step 1: Create the onboarding page**

`apps/web/app/onboarding/page.tsx` (a client component with a 3-step wizard). Key structure:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { workspacesApi, type Workspace } from '@/lib/workspaces';
import { boardsApi } from '@/lib/boards';
import { setLastActiveWorkspace } from '@/lib/active-workspace';
import { useToast } from '@/contexts/toast-context';

const STEPS = ['Create workspace', 'Invite teammates', 'Finish up'];

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [invitees, setInvitees] = useState<string[]>([]);

  const [makeSampleBoard, setMakeSampleBoard] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!user) return;
    workspacesApi
      .list()
      .then((list) => {
        if (list.length > 0) {
          const lastActive =
            user && localStorage.getItem(`lastActiveWorkspace:${user.id}`);
          router.replace(
            lastActive && list.some((w) => w.id === lastActive)
              ? `/workspaces/${lastActive}`
              : '/dashboard',
          );
        }
      })
      .catch(() => {});
  }, [user, router]);
```

Continue the wizard body with three steps (`render` by `step`):

- **Step 0** — workspace name + slug inputs (reuse the create-workspace form logic from the dashboard: `workspacesApi.create({ name, slug })`, on success `setWorkspace(ws)` and advance). "Skip for now" (X) advances without creating only when a user already... no — a workspace is required to land anywhere, so disable skip on step 0 and offer "Skip" that still requires creating? Simpler: the X on step 0 is omitted; steps 1 and 2 are skippable.

  Validation mirrors `CreateWorkspaceForm` (name + slug required; slug is lowercased per the dashboard form's convention).

- **Step 1** — invite teammates: email input + "Add" appends to `invitees`; "Invite" calls `workspacesApi.createInvitation(workspace.id, { email, role: 'EDITOR' })` per invitee (fire-and-forget with `Promise.allSettled`, toast errors). "Skip" advances.

- **Step 2** — checkbox "Create a sample board" (`makeSampleBoard`, default off); "Finish" sets `finishing`, optionally `boardsApi.create(workspace.id, { name: 'Sample board', description: 'A starter board to explore Workspace OS.' })`, then persists the active workspace and lands:

```ts
setLastActiveWorkspace(user.id, workspace.id);
router.push(`/workspaces/${workspace.id}`);
```

Add a top bar with `STEPS` labels and step indicator, and an X in the corner that (when `step > 0`) goes back / skips. Style with existing `surface`/`primary` tokens (rounded-2xl card on `bg-surface-950`).

- [ ] **Step 2: Typecheck, lint, build**

Run: `pnpm --filter @repo/web check-types`, `pnpm --filter @repo/web lint`, `pnpm --filter @repo/web build`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/onboarding/page.tsx
git commit -m "feat(web): three-step onboarding wizard"
```

---

### Task 11: Admin UI + Impersonation Client

**Files:**
- Create: `apps/web/lib/admin.ts`
- Create: `apps/web/app/admin/page.tsx`
- Create: `apps/web/app/admin/layout.tsx`
- Modify: `apps/web/components/sidebar.tsx` (nav entry for admins)

**Interfaces:**
- Consumes: Task 9 API, `User.isAdmin` (Task 8).
- Produces: `/admin` route; impersonation starts/ends client-side via localStorage token swap.

**Steps:**

- [ ] **Step 1: Create the admin API helper**

`apps/web/lib/admin.ts`:

```ts
import { api } from './api';

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  isAdmin: boolean;
  createdAt?: string;
};

export type AdminWorkspace = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export const adminApi = {
  searchUsers: (query: string) =>
    api.get<AdminUser[]>(`/admin/users?query=${encodeURIComponent(query)}`),
  searchWorkspaces: (query: string) =>
    api.get<AdminWorkspace[]>(`/admin/workspaces?query=${encodeURIComponent(query)}`),
  getSubscription: (userId: string) =>
    api.get<{ plan: string; status: string }>(
      `/admin/users/${userId}/subscription`,
    ),
  impersonate: (userId: string) =>
    api.post<{ token: string; expiresInSeconds: number; user: AdminUser }>(
      `/admin/users/${userId}/impersonate`,
    ),
};
```

- [ ] **Step 2: Create the admin page**

`apps/web/app/admin/page.tsx` ('use client'): a two-tab internal tool (`Users`, `Workspaces`).

Users tab:
- Search input + button → `adminApi.searchUsers`.
- For each row render `displayName`, `email`, `status`, a badge when `isAdmin` (disable impersonation for admins), and a "Log in as" button.
- "Log in as" → `adminApi.impersonate(userId)`; store `accessToken` in `localStorage`; clear the stored `user`/refresh session so the sidebar reflects the impersonated identity; `router.push('/dashboard')`. Render an "Impersonating as X — Exit" banner on this page driven by a `localStorage` flag (`impersonatingUserId`).
- "Exit impersonation": clear `accessToken`/`refreshToken`/`user`/`impersonatingUserId` (`localStorage.removeItem`), then `router.push('/auth/login')`.

Workspaces tab:
- Search → `adminApi.searchWorkspaces`; each row: `name`, `slug`, `status`, owner idle — and a "Subscription" chip for the user lookup that calls `adminApi.getSubscription`.

Structure: reuse the settings-page layout patterns (`mx-auto max-w-3xl`, `rounded-xl border-surface-800 bg-surface-900`), with a header "Admin — internal tool".

- [ ] **Step 3: Create the admin layout + sidebar entry**

`apps/web/app/admin/layout.tsx`: client layout wrapping `<AuthProvider>{children}</AuthProvider>` (copy `workspaces/layout.tsx`) so the sidebar/auth works.

In `apps/web/components/sidebar.tsx`:
- Add `ShieldCheck` to the lucide imports.
- In `navItems` rendering (it is a static array), render an additional entry conditionally. Change `navItems` to a function of `isAdmin`, or append after the map:

```tsx
{user?.isAdmin && (
  <Link
    href="/admin"
    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
      pathname?.startsWith('/admin')
        ? 'bg-surface-800 text-white shadow-sm'
        : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-200'
    }`}
  >
    <ShieldCheck size={16} className="text-primary-400" />
    <span>Admin</span>
  </Link>
)}
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `pnpm --filter @repo/web check-types`, `pnpm --filter @repo/web lint`, `pnpm --filter @repo/web build`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin.ts apps/web/app/admin apps/web/components/sidebar.tsx
git commit -m "feat(web): admin tooling and impersonation flow"
```

---

## Post-Plan Verification

After all tasks, run from the repo root:

```bash
pnpm --filter @repo/api build
pnpm --filter @repo/api test
pnpm --filter @repo/api lint
pnpm --filter @repo/web check-types
pnpm --filter @repo/web lint
pnpm --filter @repo/web build
```

Every command exits 0. Then confirm the migration file `packages/database/src/migrations/0006_*.sql` contains the six statements listed in Task 1 Step 10.

## Out of Scope (do not implement)

- Billing/subscription logic (stub constant only)
- Mentions feature (enum + inert pref row only)
- Web push rebuild
- Expanding search to workspaces/members/files
- Marketing/legal site