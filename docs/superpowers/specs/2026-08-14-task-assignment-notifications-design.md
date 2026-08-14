# Task Assignment Notifications — Design

Date: 2026-08-14
Status: Approved (design), pending spec review

## Problem

Assignees are only notified when a task is **created** with an assignee. Changing the assignee on an existing task (reassign), or unassigning a task, produces no notification. Assignment notifications also lack the task title, and self-assignments notify the acting user.

## Requirements

- Notify the assignee when:
  - a task is created with an assignee (existing behavior, improved)
  - an existing task's assignee changes to someone new (reassign)
  - a task's assignee is removed (unassign)
- **Skip self-notifications**: the user who made the change is never notified, even if they assign themselves.
- Notifications include the **task title** in the body.
- A straight reassign notifies both parties: the old assignee gets an unassign notification, the new assignee gets an assignment notification.
- No client changes: toasts and the `/notifications` page render all notification types generically (title, body, type badge).

## Approach

Extend the existing task events and the existing `NotificationHandler` (event bus → handler pattern already used by every other notification flow). No new modules, no new event types — a single diff handler on `TaskUpdated`.

## Components

### 1. Database — new notification type

Add `TASK_UNASSIGNED` to the `notification_type` Postgres enum.

- `packages/database/src/schema/enums/notification.enums.ts`: add `'TASK_UNASSIGNED'` to `notificationTypeEnum`
- New drizzle migration (e.g. `0003_<name>.sql`): `ALTER TYPE notification_type ADD VALUE 'TASK_UNASSIGNED';` — same pattern as the earlier `0002_charming_may_parker.sql` migration

### 2. Events — `apps/api/src/modules/tasks/events/tasks.events.ts`

- `TaskCreatedPayload` += `title: string`
- `TaskUpdatedPayload` += `title: string`, `previousAssigneeId: string | null`, `assigneeId: string | null`

### 3. Service — `apps/api/src/modules/tasks/services/tasks.service.ts`

- `create`: publish `title: task.title` in `TaskCreatedPayload`
- `update`: publish `title: updated.title`, `previousAssigneeId: task.assigneeId`, `assigneeId: updated.assigneeId` in `TaskUpdatedPayload`

### 4. Handler — `apps/api/src/modules/notifications/handlers/notification.handler.ts`

- `handleTaskCreated`:
  - return early when `assigneeId === createdBy` (self-assignment skip)
  - `body: payload.title`
- New `handleTaskUpdated` subscribed to `onTaskUpdated`:
  - `assigneeId === previousAssigneeId` → return (no change)
  - `assigneeId` set and `assigneeId !== updatedBy` → `TASK_ASSIGNED`, title "You were assigned a task", body = task title
  - `previousAssigneeId` set and `previousAssigneeId !== updatedBy` → `TASK_UNASSIGNED`, title "You were unassigned from a task", body = task title

### 5. Client

No changes.

## Data Flow

```
tasks.service (create/update)
  → TasksEventBus.publishTaskCreated / publishTaskUpdated (with title + assignee diff)
  → NotificationHandler.handleTaskCreated / handleTaskUpdated
  → NotificationsService.createAndDeliver(userId, {type, title, body, resourceType: 'task', resourceId})
  → notifications table + socket `notification:created`
  → client toast (NotificationListener) + /notifications page
```

## Testing

- `notification.handler.spec.ts`:
  - create with assignee → notified with title body; self-assign → skipped
  - reassign (old A, new B) → A gets `TASK_UNASSIGNED`, B gets `TASK_ASSIGNED`
  - unassign → old assignee gets `TASK_UNASSIGNED`
  - assignee unchanged → no notification
  - reassign where `updatedBy` is the new assignee → new assignee not notified, old assignee still gets `TASK_UNASSIGNED`
- `tasks.service.spec.ts`: update publishes `previousAssigneeId`/`assigneeId`/`title` in the event payload
- `tasks.events.spec.ts`: payload types carry the new fields

## Deployment

- API: Render manual deploy (runs migrations on boot via `startCommand`)
- Web: no deploy needed (no client changes)

## Out of Scope

- Email notifications (channel is `IN_APP` only)
- Notification preferences/opt-outs
- Due-date or priority change notifications