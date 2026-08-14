# Task Assignment Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify assignees on task create, reassign, and unassign (skipping self-notifications, including the task title in the body).

**Architecture:** Extend the existing task event payloads (`TaskCreatedPayload`, `TaskUpdatedPayload`) to carry title + assignee diff, then add/update handlers in the existing `NotificationHandler` (event bus → handler → `NotificationsService.createAndDeliver` → notifications table + socket `notification:created`). Add `TASK_UNASSIGNED` to the `notification_type` Postgres enum.

**Tech Stack:** NestJS, drizzle-orm (pg), Postgres enum, Jest (API spec tests), EventEmitter-based event buses.

## Global Constraints

- Notification types are a Postgres enum (`notificationTypeEnum`) — adding a type requires a drizzle migration.
- All notifications flow through `NotificationsService.createAndDeliver(userId, {type, title, body, resourceType, resourceId})`.
- The `NotificationHandler` subscribes to event buses in `onModuleInit` and handles each event in a `handle*` method wrapped in try/catch with `this.logger.error`.
- Handler spec style: real `TasksEventBus` instances, jest-mocked `NotificationsService`, publish then `await new Promise((r) => setTimeout(r, 10))`, assert on `createAndDeliver`.
- Commit messages follow conventional commits; the repo runs `turbo run lint` + commitlint on commit (headers ≤ 100 chars).
- Tests: `pnpm --filter api test` (or `pnpm --filter api exec jest <path>` for a single file).

---

### Task 1: Add `TASK_UNASSIGNED` enum value + migration

**Files:**
- Modify: `packages/database/src/schema/enums/notification.enums.ts`
- Create (generated): `packages/database/src/migrations/<next>_<name>.sql` + journal entry in `packages/database/src/migrations/meta/_journal.json`
- Test: inspect generated files (no unit tests exist for enums)

**Interfaces:**
- Consumes: nothing
- Produces: `TASK_UNASSIGNED` in `notificationTypeEnum` → `NotificationType` union (used by Task 5 handler)

- [ ] **Step 1: Add the enum value**

In `packages/database/src/schema/enums/notification.enums.ts`, change:

```ts
export const notificationTypeEnum = pgEnum('notification_type', [
  'COMMENT_ADDED',
  'BOARD_SHARED',
  'WORKSPACE_UPDATED',
  'MENTION_CREATED',
  'MEMBER_ADDED',
  'INVITATION_ACCEPTED',
  'TASK_ASSIGNED',
  'FILE_UPLOADED',
]);
```

to:

```ts
export const notificationTypeEnum = pgEnum('notification_type', [
  'COMMENT_ADDED',
  'BOARD_SHARED',
  'WORKSPACE_UPDATED',
  'MENTION_CREATED',
  'MEMBER_ADDED',
  'INVITATION_ACCEPTED',
  'TASK_ASSIGNED',
  'TASK_UNASSIGNED',
  'FILE_UPLOADED',
]);
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter @repo/database generate`

Expected: a new file `packages/database/src/migrations/<idx>_<name>.sql` plus a new entry in `meta/_journal.json` and a new `meta/<idx>_snapshot.json`.

- [ ] **Step 3: Verify the generated SQL**

Open the generated `.sql` file. It MUST contain exactly the enum change:

```sql
ALTER TYPE "public"."notification_type" ADD VALUE 'TASK_UNASSIGNED';
```

If the generated file contains OTHER statements (e.g. canvas table creation, `FILE_UPLOADED` — stale snapshot), discard the generated file and hand-write the migration instead:
1. Create `packages/database/src/migrations/0003_task_unassigned.sql` containing exactly the `ALTER TYPE` line above.
2. Append to `meta/_journal.json` `entries` array (copy the format of the last entry; `idx` = 3, `tag` = `"0003_task_unassigned"`):
   ```json
   {
     "idx": 3,
     "version": "7",
     "when": 1786700000000,
     "tag": "0003_task_unassigned",
     "breakpoints": true
   }
   ```
   (`when` = current epoch ms: `date +%s%3N`.)

- [ ] **Step 4: Typecheck the database package**

Run: `pnpm --filter @repo/database exec tsc --noEmit`
Expected: exit 0 (proves `TASK_UNASSIGNED` is a valid `NotificationType`).

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schema/enums/notification.enums.ts packages/database/src/migrations
git commit -m "feat(db): add TASK_UNASSIGNED notification type"
```

---

### Task 2: Extend task event payloads with title + assignee diff

**Files:**
- Modify: `apps/api/src/modules/tasks/events/tasks.events.ts`
- Test: `apps/api/src/modules/tasks/events/tasks.events.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TaskCreatedPayload = { taskId: string; boardId: string; columnId: string; createdBy: string; assigneeId?: string; title: string }`
  - `TaskUpdatedPayload = { taskId: string; updatedBy: string; title: string; previousAssigneeId: string | null; assigneeId: string | null }`
  (consumed by Tasks 3, 4, 5)

- [ ] **Step 1: Write the failing test**

In `apps/api/src/modules/tasks/events/tasks.events.spec.ts`, after the existing `emits TaskMoved` test, add:

```ts
  it('emits TaskUpdated with title and assignee diff', () => {
    const fn = jest.fn();
    bus.onTaskUpdated(fn);
    const payload = {
      taskId: 't1',
      updatedBy: 'u1',
      title: 'Set up CI/CD',
      previousAssigneeId: 'u2',
      assigneeId: 'u3',
    };
    bus.publishTaskUpdated(payload);
    expect(fn).toHaveBeenCalledWith(payload);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api exec jest src/modules/tasks/events/tasks.events.spec.ts -t "TaskUpdated" -v`
Expected: FAIL — `TypeError: bus.onTaskUpdated is not a function` (no `onTaskUpdated` on the bus yet).

- [ ] **Step 3: Implement**

In `apps/api/src/modules/tasks/events/tasks.events.ts`:

Change `TaskCreatedPayload`:

```ts
export type TaskCreatedPayload = {
  taskId: string;
  boardId: string;
  columnId: string;
  createdBy: string;
  assigneeId?: string;
  title: string;
};
```

Change `TaskUpdatedPayload`:

```ts
export type TaskUpdatedPayload = {
  taskId: string;
  updatedBy: string;
  title: string;
  previousAssigneeId: string | null;
  assigneeId: string | null;
};
```

After `publishTaskUpdated`, add:

```ts
  onTaskUpdated(listener: (payload: TaskUpdatedPayload) => void): void {
    this.emitter.on(TASKS_EVENTS.taskUpdated, listener);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter api exec jest src/modules/tasks/events/tasks.events.spec.ts -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tasks/events/tasks.events.ts apps/api/src/modules/tasks/events/tasks.events.spec.ts
git commit -m "feat(api): carry title and assignee diff in task events"
```

---

### Task 3: Publish title + assignee diff from TasksService

**Files:**
- Modify: `apps/api/src/modules/tasks/services/tasks.service.ts` (create ~line 68, update ~line 149)
- Test: `apps/api/src/modules/tasks/services/tasks.service.spec.ts`

**Interfaces:**
- Consumes: extended payload types from Task 2
- Produces: real events carrying `title`, `previousAssigneeId`, `assigneeId` (consumed by Task 5 handler)

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/tasks/services/tasks.service.spec.ts`:

1. In the `create` test ('creates a task in a column', ~line 146), change the assertion:

```ts
      expect(events.publishTaskCreated).toHaveBeenCalledWith({
        taskId: 't1',
        boardId: 'b1',
        columnId: 'c1',
        createdBy: 'u1',
        title: 'Set up CI/CD',
      });
```

2. In `describe('update')`, after the existing 'updates a task' test, add:

```ts
    it('publishes assignee diff in TaskUpdated', async () => {
      const previouslyAssigned = { ...mockTask, assigneeId: 'u2' };
      const reassigned = { ...mockTask, assigneeId: 'u3' };
      tasksRepo.findById.mockResolvedValue(previouslyAssigned);
      mockDbSelect([mockMembership]);
      policy.isAtLeast.mockReturnValue(true);
      tasksRepo.update.mockResolvedValue(reassigned);

      await service.update('t1', 'u1', { assigneeId: 'u3' });

      expect(events.publishTaskUpdated).toHaveBeenCalledWith({
        taskId: 't1',
        updatedBy: 'u1',
        title: 'Set up CI/CD',
        previousAssigneeId: 'u2',
        assigneeId: 'u3',
      });
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api exec jest src/modules/tasks/services/tasks.service.spec.ts -v`
Expected: FAIL — the create assertion mismatch (`title` missing from the called payload) and the new update test (`expect(received).toHaveBeenCalledWith(...)` — payload lacks the new fields).

- [ ] **Step 3: Implement**

In `apps/api/src/modules/tasks/services/tasks.service.ts`:

In `create`, change the publish (line ~68):

```ts
    this.events.publishTaskCreated({
      taskId: task.id,
      boardId,
      columnId,
      createdBy: userId,
      assigneeId: task.assigneeId ?? undefined,
      title: task.title,
    });
```

In `update`, change the publish (line ~149) from:

```ts
    this.events.publishTaskUpdated({ taskId, updatedBy: userId });
```

to:

```ts
    this.events.publishTaskUpdated({
      taskId,
      updatedBy: userId,
      title: updated.title,
      previousAssigneeId: task.assigneeId,
      assigneeId: updated.assigneeId,
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api exec jest src/modules/tasks/services/tasks.service.spec.ts -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tasks/services/tasks.service.ts apps/api/src/modules/tasks/services/tasks.service.spec.ts
git commit -m "feat(api): publish task title and assignee diff"
```

---

### Task 4: Improve create-flow notification (title body + self-skip)

**Files:**
- Modify: `apps/api/src/modules/notifications/handlers/notification.handler.ts` (`handleTaskCreated`, line ~136)
- Test: `apps/api/src/modules/notifications/handlers/notification.handler.spec.ts`

**Interfaces:**
- Consumes: `TaskCreatedPayload` with `title` (Task 2/3)
- Produces: nothing new downstream

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/notifications/handlers/notification.handler.spec.ts`:

1. Change the existing 'should deliver TASK_ASSIGNED notification on TaskCreated when assigneeId is present' test (~line 109) to include `title` and assert the body:

```ts
  it('should deliver TASK_ASSIGNED notification on TaskCreated when assigneeId is present', async () => {
    tasksEventBus.publishTaskCreated({
      taskId: 't-1',
      boardId: 'b-1',
      columnId: 'c-1',
      createdBy: 'user-1',
      assigneeId: 'user-2',
      title: 'Fix login bug',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-2',
      {
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        body: 'Fix login bug',
        resourceType: 'task',
        resourceId: 't-1',
      },
    );
  });

  it('should skip TASK_ASSIGNED when assignee is the creator', async () => {
    tasksEventBus.publishTaskCreated({
      taskId: 't-1',
      boardId: 'b-1',
      columnId: 'c-1',
      createdBy: 'user-1',
      assigneeId: 'user-1',
      title: 'My own task',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api exec jest src/modules/notifications/handlers/notification.handler.spec.ts -v`
Expected: FAIL — body is `undefined` (not `'Fix login bug'`) and the self-assign test receives a notification (called once).

- [ ] **Step 3: Implement**

In `apps/api/src/modules/notifications/handlers/notification.handler.ts`, change `handleTaskCreated`:

```ts
  private async handleTaskCreated(payload: TaskCreatedPayload): Promise<void> {
    if (!payload.assigneeId || payload.assigneeId === payload.createdBy) return;
    try {
      await this.notifications.createAndDeliver(payload.assigneeId, {
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        body: payload.title,
        resourceType: 'task',
        resourceId: payload.taskId,
      });
    } catch (err) {
      this.logger.error('Failed to handle TaskCreated', err);
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api exec jest src/modules/notifications/handlers/notification.handler.spec.ts -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/handlers/notification.handler.ts apps/api/src/modules/notifications/handlers/notification.handler.spec.ts
git commit -m "feat(api): include task title and skip self in assignment notice"
```

---

### Task 5: Notify on reassign and unassign (TaskUpdated handler)

**Files:**
- Modify: `apps/api/src/modules/notifications/handlers/notification.handler.ts` (`onModuleInit` + new `handleTaskUpdated`)
- Test: `apps/api/src/modules/notifications/handlers/notification.handler.spec.ts`

**Interfaces:**
- Consumes: `TaskUpdatedPayload` from Task 2/3, `TASK_UNASSIGNED` type from Task 1
- Produces: nothing new downstream

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/notifications/handlers/notification.handler.spec.ts`, after the TaskCreated tests, add:

```ts
  it('should deliver TASK_ASSIGNED and TASK_UNASSIGNED on reassign', async () => {
    tasksEventBus.publishTaskUpdated({
      taskId: 't-1',
      updatedBy: 'user-1',
      title: 'Fix login bug',
      previousAssigneeId: 'user-2',
      assigneeId: 'user-3',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-3',
      {
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        body: 'Fix login bug',
        resourceType: 'task',
        resourceId: 't-1',
      },
    );
    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-2',
      {
        type: 'TASK_UNASSIGNED',
        title: 'You were unassigned from a task',
        body: 'Fix login bug',
        resourceType: 'task',
        resourceId: 't-1',
      },
    );
  });

  it('should deliver TASK_UNASSIGNED only when assignee is removed', async () => {
    tasksEventBus.publishTaskUpdated({
      taskId: 't-1',
      updatedBy: 'user-1',
      title: 'Fix login bug',
      previousAssigneeId: 'user-2',
      assigneeId: null,
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).toHaveBeenCalledTimes(1);
    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-2',
      {
        type: 'TASK_UNASSIGNED',
        title: 'You were unassigned from a task',
        body: 'Fix login bug',
        resourceType: 'task',
        resourceId: 't-1',
      },
    );
  });

  it('should deliver nothing when assignee is unchanged', async () => {
    tasksEventBus.publishTaskUpdated({
      taskId: 't-1',
      updatedBy: 'user-1',
      title: 'Fix login bug',
      previousAssigneeId: 'user-2',
      assigneeId: 'user-2',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).not.toHaveBeenCalled();
  });

  it('should not notify the updater when they reassign to themselves', async () => {
    tasksEventBus.publishTaskUpdated({
      taskId: 't-1',
      updatedBy: 'user-3',
      title: 'Fix login bug',
      previousAssigneeId: 'user-2',
      assigneeId: 'user-3',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).toHaveBeenCalledTimes(1);
    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-2',
      {
        type: 'TASK_UNASSIGNED',
        title: 'You were unassigned from a task',
        body: 'Fix login bug',
        resourceType: 'task',
        resourceId: 't-1',
      },
    );
  });

  it('should deliver TASK_ASSIGNED when a task becomes assigned', async () => {
    tasksEventBus.publishTaskUpdated({
      taskId: 't-1',
      updatedBy: 'user-1',
      title: 'Fix login bug',
      previousAssigneeId: null,
      assigneeId: 'user-2',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(notificationsService.createAndDeliver).toHaveBeenCalledTimes(1);
    expect(notificationsService.createAndDeliver).toHaveBeenCalledWith(
      'user-2',
      {
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        body: 'Fix login bug',
        resourceType: 'task',
        resourceId: 't-1',
      },
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api exec jest src/modules/notifications/handlers/notification.handler.spec.ts -v`
Expected: all five new tests FAIL (no `handleTaskUpdated` — `createAndDeliver` never called).

- [ ] **Step 3: Implement**

In `apps/api/src/modules/notifications/handlers/notification.handler.ts`:

In `onModuleInit`, after the `onTaskCreated` subscription, add:

```ts
    this.tasksEventBus.onTaskUpdated((p) => {
      void this.handleTaskUpdated(p);
    });
```

Add `TaskUpdatedPayload` to the type import from `'../../tasks/events/tasks.events'`:

```ts
import type {
  TaskCreatedPayload,
  TaskUpdatedPayload,
} from '../../tasks/events/tasks.events';
```

After `handleTaskCreated`, add:

```ts
  private async handleTaskUpdated(payload: TaskUpdatedPayload): Promise<void> {
    if (payload.assigneeId === payload.previousAssigneeId) return;
    try {
      if (payload.assigneeId && payload.assigneeId !== payload.updatedBy) {
        await this.notifications.createAndDeliver(payload.assigneeId, {
          type: 'TASK_ASSIGNED',
          title: 'You were assigned a task',
          body: payload.title,
          resourceType: 'task',
          resourceId: payload.taskId,
        });
      }
      if (
        payload.previousAssigneeId &&
        payload.previousAssigneeId !== payload.updatedBy
      ) {
        await this.notifications.createAndDeliver(payload.previousAssigneeId, {
          type: 'TASK_UNASSIGNED',
          title: 'You were unassigned from a task',
          body: payload.title,
          resourceType: 'task',
          resourceId: payload.taskId,
        });
      }
    } catch (err) {
      this.logger.error('Failed to handle TaskUpdated', err);
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api exec jest src/modules/notifications/handlers/notification.handler.spec.ts -v`
Expected: all PASS (existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/handlers/notification.handler.ts apps/api/src/modules/notifications/handlers/notification.handler.spec.ts
git commit -m "feat(api): notify on task reassign and unassign"
```

---

### Task 6: Full verification

**Files:** none

- [ ] **Step 1: Run the full API test suite**

Run: `pnpm --filter api test`
Expected: all tests pass.

- [ ] **Step 2: Typecheck the API**

Run: `pnpm --filter api exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `pnpm --filter api lint`
Expected: exit 0 (existing warnings only, no errors).

- [ ] **Step 4: Confirm migration validity**

Run: `pnpm --filter @repo/database exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Final commit of any leftovers**

```bash
git status --short
```
If clean, nothing to commit.

## Deployment Notes (after implementation)

- API: manual Render deploy — `startCommand` runs `pnpm --filter @repo/database migrate` on boot, which applies the new migration (adds `TASK_UNASSIGNED` to the live enum), then restarts with the new handler code.
- Web: no deploy needed (no client changes).
- Manual smoke test: create task assigned to member B → B's toast shows "You were assigned a task / <title>"; reassign to C → B gets unassigned toast, C gets assigned toast; unassign → B gets unassigned toast; self-assign → no notification.
