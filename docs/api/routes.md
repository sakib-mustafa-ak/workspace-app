# API Routes

Base URL: `http://localhost:4000/api/v1` (dev).

## Conventions

- **Auth:** every route is JWT-guarded by a global guard unless marked `[public]`. Guard is Bearer access token: `Authorization: Bearer <token>`.
- **Response envelope:** all responses are wrapped as `{ success: true, message: "Request successful.", data }` by the global `ResponseInterceptor`.
- **Errors:** business errors are thrown as typed exceptions and normalized by `BusinessExceptionFilter`. Validation errors are 400 with `whitelist` + `forbidNonWhitelisted` enabled globally.
- **Versioning:** URI-based versioning, default `v1`.
- **Permission model:** most routes require workspace membership; write/role checks are enforced by policies in each module (see `docs/domain/04-permissions.md`).

## Health

| Method | Path            | Notes                  |
| ------ | --------------- | ---------------------- |
| GET    | `/health`       | `[public]` liveness    |

## Auth (`modules/auth`)

| Method | Path                              | Notes                                        |
| ------ | --------------------------------- | -------------------------------------------- |
| POST   | `/auth/register`                  | `[public]` register email + password         |
| POST   | `/auth/login`                     | `[public]` returns access + refresh tokens   |
| POST   | `/auth/refresh`                   | `[public]` rotate refresh token              |
| POST   | `/auth/logout`                    | revoke current session                       |
| POST   | `/auth/request-verification`      | `[public]` re-send email verification link   |
| POST   | `/auth/verify-email`              | `[public]` consume selector + verifier token |
| POST   | `/auth/request-password-reset`    | `[public]` issue password-reset token        |
| POST   | `/auth/reset-password`            | `[public]` reset password                    |
| GET    | `/auth/me`                        | current user profile                         |

Token config: `JWT_ACCESS_TTL_SECONDS=900` (15 min), `JWT_REFRESH_TTL_SECONDS=2592000` (30 d).

## Users (`modules/users`)

| Method | Path          | Notes                                                |
| ------ | ------------- | ---------------------------------------------------- |
| GET    | `/users/me`   | current user profile                                 |
| PATCH  | `/users/me`   | update display name, avatar, bio, timezone, locale   |
| GET    | `/users/:id`  | public user profile                                  |
| GET    | `/users`      | list (query: `limit`, `offset`)                      |
| DELETE | `/users/:id`  | (self) account deletion                              |

## Workspaces (`modules/workspaces`)

| Method | Path                                 | Notes                                            |
| ------ | ------------------------------------ | ------------------------------------------------ |
| POST   | `/workspaces`                        | create (creator becomes OWNER member)            |
| GET    | `/workspaces`                        | list my workspaces                               |
| GET    | `/workspaces/invitations/pending`    | pending invitations for me                       |
| GET    | `/workspaces/:id`                    | workspace detail                                 |
| PATCH  | `/workspaces/:id`                    | rename/update profile                            |
| POST   | `/workspaces/:id/archive`            | archive                                          |
| POST   | `/workspaces/:id/unarchive`          | restore                                          |
| DELETE | `/workspaces/:id`                    | delete (soft)                                    |
| GET    | `/workspaces/:id/members`            | list members                                     |
| PATCH  | `/workspaces/:id/members/:userId/role` | change member role (ADMIN+)                    |
| DELETE | `/workspaces/:id/members/:userId`    | remove member                                    |
| POST   | `/workspaces/:id/transfer`           | transfer ownership                               |
| POST   | `/workspaces/:id/invitations`        | invite by email (creates PENDING invitation)    |
| GET    | `/workspaces/:id/invitations`        | list invitations                                 |
| DELETE | `/workspaces/:id/invitations/:invitationId` | revoke invitation                        |
| POST   | `/workspaces/invitations/accept`     | accept invitation (selector + verifier)         |

## Boards + Columns (`modules/boards`)

All under `workspaces/:workspaceId/boards`.

| Method | Path                                         | Notes                                   |
| ------ | -------------------------------------------- | --------------------------------------- |
| POST   | `.`                                          | create board                            |
| POST   | `/import`                                    | import board from a template payload    |
| POST   | `/templates`                                 | create from shipped template            |
| GET    | `.`                                          | list boards in workspace                |
| GET    | `/:boardId`                                  | board detail                            |
| PATCH  | `/:boardId`                                  | rename, description, position           |
| POST   | `/:boardId/archive` / `/:boardId/unarchive`  | archive / restore                       |
| DELETE | `/:boardId`                                  | delete (soft)                           |
| GET    | `/:boardId/columns`                          | list columns                            |
| POST   | `/:boardId/columns`                          | create column                           |
| PATCH  | `/:boardId/columns/:columnId`                | rename / reorder                        |
| POST   | `/:boardId/columns/:columnId/archive`        | archive column                          |
| POST   | `/:boardId/export`                           | export board data                       |

## Tasks (`modules/tasks`)

All under `workspaces/:workspaceId/boards/:boardId/tasks`.

| Method | Path                       | Notes                                      |
| ------ | -------------------------- | ------------------------------------------ |
| POST   | `/columns/:columnId`       | create task in column                      |
| GET    | `.`                        | list tasks (board-wide)                    |
| GET    | `/columns/:columnId`       | list tasks in column                       |
| GET    | `/:taskId`                 | task detail                                |
| PATCH  | `/:taskId`                 | edit title/description/status/priority/assignee/due date |
| PATCH  | `/:taskId/move`            | move to another column + position          |
| DELETE | `/:taskId`                 | delete task                                |

## Checklists (`modules/checklists`)

All under `workspaces/:workspaceId/boards/:boardId/tasks/:taskId/checklist`.

| Method | Path            | Notes                                 |
| ------ | --------------- | ------------------------------------- |
| GET    | `.`             | list checklist items for the task     |
| POST   | `.`             | add item                              |
| PATCH  | `/:itemId`      | toggle `completed`, edit text, reorder|
| DELETE | `/:itemId`      | remove item                           |

## Comments (`modules/comments`)

All under `boards/:boardId/comments`.

| Method | Path            | Notes                                  |
| ------ | --------------- | -------------------------------------- |
| POST   | `.`             | add comment (optionally reply via `parentId`) |
| GET    | `.`             | list comments for board                |
| GET    | `/:commentId`   | comment detail                         |
| PATCH  | `/:commentId`   | edit content (sets `editedAt`)         |
| DELETE | `/:commentId`   | delete comment                         |

## Canvas (`modules/canvas`)

All under `boards/:boardId/canvas` (board-scoped, not workspace-scoped).

| Method | Path                       | Notes                                       |
| ------ | -------------------------- | ------------------------------------------- |
| GET    | `.`                        | canvas + all objects                        |
| POST   | `/objects`                 | create object                               |
| PATCH  | `/objects/:objectId`       | update object (geometry, style, `data`, z-order) |
| DELETE | `/objects/:objectId`       | delete object                               |

Realtime ops (move/resize per frame) are broadcast through the Socket.IO gateway, not REST (see `docs/features/canvas.md`).

## Notifications (`modules/notifications`)

| Method | Path                 | Notes                                 |
| ------ | -------------------- | ------------------------------------- |
| GET    | `/notifications`     | list (query: `limit`, `offset`)       |
| GET    | `/notifications/unread/count` | unread count                  |
| GET    | `/notifications/:id` | detail                               |
| PATCH  | `/notifications/:id/read` | mark read                        |
| POST   | `/notifications/read-all` | mark all read                    |
| DELETE | `/notifications/:id` | delete notification                  |

## Audit (`modules/audit`)

| Method | Path                            | Notes                           |
| ------ | ------------------------------- | ------------------------------- |
| GET    | `/workspaces/:id/activity`      | workspace activity feed (query: pagination) |

## Uploads (`modules/uploads`)

All under `workspaces/:workspaceId/uploads`.

| Method | Path              | Notes                                  |
| ------ | ----------------- | -------------------------------------- |
| POST   | `.`               | multipart upload (currently local disk)|
| GET    | `.`               | list uploads in workspace              |
| GET    | `/boards/:boardId`| list uploads for a board               |
| DELETE | `/:uploadId`      | delete upload                          |

Static files served at `/uploads/*` (dev local disk).

## Search (`modules/search`)

| Method | Path         | Notes                                            |
| ------ | ------------ | ------------------------------------------------ |
| GET    | `/search?q=` | global search scoped to my workspaces; returns `{ query, boards: [{ id, title, workspaceId, type }] }` |

## AI (`modules/ai`)

| Method | Path                         | Notes                                        |
| ------ | ---------------------------- | -------------------------------------------- |
| POST   | `/ai/boards/:boardId/summarize` | board summary via AI provider            |
| POST   | `/ai/ideas`                  | generate ideas from a topic (`topic`, `count`) |

AI endpoints are scaffolded (provider abstraction exists; board summary currently feeds sample data — not production-wired). See `docs/features/ai.md`.