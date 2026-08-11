# Feature: Comments

Threaded comments on boards (visible in the board page / task context).

## What it does

- Add a comment to a board; replies via `parentId` (one level of threading).
- Edit (sets `edited_at`) and delete comments.
- Board-scoped listing; all comments require workspace membership (board access).

## Endpoints

`/boards/:boardId/comments/*` — POST, GET, GET `:commentId`, PATCH, DELETE (see `docs/api/routes.md`).

## Tables

`board_comments` (see `docs/database/schema.md`).

## Events

Comment creation fans out into notifications for the board watchers/assignees path (see `docs/features/notifications.md`). `COMMENT_ADDED` and `MENTION_CREATED` notification types exist; handlers cover the comment-added path.

## Status

Complete.