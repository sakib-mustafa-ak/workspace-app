# Notifications Event Handlers — Design Spec

## Purpose

Wire up the existing `NotificationsService` to subscribe to domain events from all modules and automatically create + deliver notifications for relevant users.

## Event-to-Notification Mapping

| Source Event | Notification Type | Target Users |
|---|---|---|
| `BoardsEventBus.onBoardCreated` | `BOARD_SHARED` | All workspace members via `WorkspaceMembersRepository` |
| `BoardsEventBus.onBoardArchived` | `BOARD_SHARED` | All workspace members |
| `CommentsEventBus.onCommentCreated` | `COMMENT_ADDED` | Board members (exclude comment author) via `BoardColumnsRepository` → board workspace → members |
| `TasksEventBus.onTaskCreated` | `TASK_ASSIGNED` | Only if payload includes assignee; notify the assignee |
| `WorkspacesEventBus.onMemberAdded` | `MEMBER_ADDED` | The added user |
| `WorkspacesEventBus.onInvitationAccepted` | `INVITATION_ACCEPTED` | Workspace admins/owners |
| `UploadsEventBus.onFileUploaded` | `FILE_UPLOADED` (new type) | Board members if boardId present |

## Architecture

### New files

- `apps/api/src/modules/notifications/handlers/notification.handler.ts`
  - Single class `NotificationHandler` that implements `OnModuleInit`
  - Injects: `NotificationsService`, `WorkspaceMembersRepository`, `BoardsRepository`, `BoardColumnsRepository`, and all event buses
  - Subscribes to each event bus in `onModuleInit()`
  - For each event: resolves target user IDs, calls `NotificationsService.createAndDeliver()` per user

- `apps/api/src/modules/notifications/policies/notification.policy.ts`
  - `NotificationPolicy` class with `canRead(userId, notificationId)` and `canArchive(userId, notificationId)`
  - Checks ownership via `NotificationsRepository.findById()`

### Modified files

- `notifications.module.ts` — add `NotificationHandler` and `NotificationPolicy` to providers; import `WorkspaceMembersRepository`, `BoardsRepository`, `BoardColumnsRepository` as providers (direct injection, same pattern as canvas/uploads modules)
- `packages/database/src/schema/enums/notification.enums.ts` — add `'FILE_UPLOADED'` to `notificationTypeEnum`
- Migration 0003 for the new enum value

## Handler Logic Details

**BoardCreated:** Fetch workspace members via `WorkspaceMembersRepository.findByWorkspace()`. Notify all members (including owner — owner already knows, but notification is informational).

**CommentCreated:** Fetch board's workspace via `BoardsRepository.findById()`. Then fetch workspace members. Exclude the comment author (`payload.userId`). Each member gets `COMMENT_ADDED` with `resourceType: 'board'`, `resourceId: boardId`.

**TaskCreated:** If `payload.assigneeId` is set in the task payload, create `TASK_ASSIGNED` for that user. Note: current `TaskCreatedPayload` doesn't include assigneeId — either extend it or skip for now.

**MemberAdded:** Single notification to `payload.userId` with type `MEMBER_ADDED`.

**InvitationAccepted:** Fetch workspace owners/admins, notify each with `INVITATION_ACCEPTED`.

**FileUploaded:** If `payload.boardId` is set, fetch workspace members (via board → workspace), notify all with `FILE_UPLOADED`.

## Files Not Modified

- No frontend changes — the existing notifications page already lists all notification types
- No controller/service/repository changes — they already work for CRUD
- No new database tables

## Open Decisions

- **TaskCreated assignee**: Current `TaskCreatedPayload` lacks `assigneeId`. Option A: add it to the payload + update the publish call site. Option B: skip task assignment notifications for now. **Chosen: Option A** — one-line payload extension.
