# Feature: Canvas

Freeform visual canvas per board with full drawing/annotation toolset and realtime collaboration.

## What it does

- Object types: rectangle, ellipse, text, sticky note, image, arrow, line, path (freehand), frame, connector — `canvas_object_type` enum.
- Full styling per object: fill, stroke, stroke width, opacity; geometry (`x`, `y`, `width`, `height`, `rotation`, `z_index`); type-specific payload in `data` JSONB (text content, image metadata, path points).
- Undo/redo, zoom to cursor, pan, keyboard tool shortcuts (V/R/O/L/A/T/N/C), delete.
- Image upload into the canvas (uses the uploads feature).
- Realtime: presence (who is on the board), live cursors, per-object edit locks, broadcast of create/update/delete across clients.

## Endpoints + realtime

REST (authoritative writes): `/boards/:boardId/canvas` + `/objects` CRUD — `docs/api/routes.md`.

Socket.IO (namespace `/canvas`, e.g. `http://localhost:4000/canvas`):
- `board:join` / `board:leave` — room membership per board
- `cursor:move` — broadcast cursor position
- `object:created` / `object:updated` / `object:deleted` — realtime mutation broadcast
- `object:lock` / `object:unlock` — exclusive edit lock per object

High-frequency interaction (drag/resize) streams updates over Socket.IO with batched persistence (`batch` flag on canonical updates) — a gesture emits many frames but persists one canonical state. Undo snapshots are taken at gesture start.

## Tables

`canvas` (1:1 with board), `canvas_objects`.

## Frontend architecture

- `apps/web/lib/canvas-socket.ts` — Socket.IO client.
- Canvas state machine (React reducer): `ZOOM_AT` zoom-to-cursor, `SNAPSHOT` for undo stack, `batch` flags per action.
- `canvas-surface.tsx` — pointer interactions, click-create normalization for text/sticky notes, text editing box, empty-state hint, shortcuts.
- `toolbar.tsx` — single-row tool palette, system color swatches, zoom %, delete, image upload.
- `canvas-renderer.ts` — renders with theme-color caching keyed on the root class.
- `selection-manager.ts` — zoom-aware hit testing (handles 10/zoom px, lines 8/zoom px).
- `layer-panel.tsx`, `context-menu.tsx` — object list with type labels, right-click actions (edit text, delete).

## Status

Complete and E2E-verified (desktop + mobile viewports). Real-time presence and locks verified with two clients.