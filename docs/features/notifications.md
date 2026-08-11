# Feature: Notifications

In-app notification feed generated from domain events.

## What it does

- Notifications are created by handlers subscribing to domain events and stored per user (`notifications` table).
- Lifecycle: `CREATED → QUEUED → DELIVERED → READ` (plus `ARCHIVED`).
- Types: COMMENT_ADDED, BOARD_SHARED, WORKSPACE_UPDATED, MENTION_CREATED, MEMBER_ADDED, INVITATION_ACCEPTED, TASK_ASSIGNED, FILE_UPLOADED.
- Channels: `IN_APP` (active), `EMAIL` (enum reserved; delivery not wired).
- User-scoped feed with unread count, mark-read, mark-all-read, and delete.

## Handlers

`modules/notifications/handlers/notification.handler.ts` subscribes to domain events and creates notifications for:
- `BOARD_SHARED` — board shared with you
- `COMMENT_ADDED` — comment on a board you care about
- `TASK_ASSIGNED` — task assigned to you
- `MEMBER_ADDED` — added to a workspace
- `INVITATION_ACCEPTED` — someone accepted your invitation
- `FILE_UPLOADED` — file uploaded to a board you can see

## Endpoints

`/notifications*` — GET list (`limit`, `offset`), GET unread/count, GET `:id`, PATCH `:id/read`, POST read-all, DELETE `:id` (see `docs/api/routes.md`).

## Web UI

Notification center in the web app header with unread badge; feed refreshes in-app.

## Status

Complete for in-app channel. Push notifications and real email delivery are parked pending the deployment/infra decision (see `docs/launch-checklist.md`).