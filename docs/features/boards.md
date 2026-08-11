# Feature: Boards

Boards are the work surface: Kanban columns with tasks, plus the canvas (separate feature) and comments.

## What it does

- CRUD boards within a workspace; ordered by `position` (unique per workspace among live rows).
- Archive/unarchive boards and columns (archived columns hide tasks from the active board).
- Columns per board: create, rename, reorder, archive.
- Templates: create a board from a shipped template and import boards from a template payload.
- Export board data.
- Tasks live inside columns with their own status/priority/due-date model — see `/tasks` in `docs/api/routes.md` and `task.schema.ts`.

## Endpoints

`/workspaces/:workspaceId/boards/*` and the nested `/tasks/*`, `/checklist`, `/comments`, `/canvas` trees — see `docs/api/routes.md`.

## Tables

`boards`, `board_columns`, `tasks`, `checklist_items` (see `docs/database/schema.md`).

## Web UI

- Board page renders Kanban with drag-and-drop across columns (moves persist via `PATCH /tasks/:taskId/move`), a task dialog (description, assignee, due date, priority, checklist), comments, and a calendar view toggle showing tasks with/without due dates.
- Canvas route is linked from the board page (`/boards/:boardId/canvas`).

## Status

Complete. Remaining niceties tracked in `docs/roadmap/features.md` (e.g. board-level realtime beyond canvas).