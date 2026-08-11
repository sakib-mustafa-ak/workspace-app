# Feature: Uploads

File uploads scoped to workspaces and optionally boards (canvas images today, future task attachments).

## What it does

- Multipart upload → stored via a `StorageProvider` abstraction; today's implementation is `LocalStorageProvider` (files on local disk under `./uploads`, served statically at `/uploads/*`).
- Every upload records `original_name`, `mime_type`, `size`, `storage_key`, `url`, `provider` (default `local`).
- Workspace-scoped listing; board-scoped listing; delete.

## Endpoints

`/workspaces/:workspaceId/uploads/*` — POST, GET, GET `/boards/:boardId`, DELETE `/:uploadId` (see `docs/api/routes.md`).

## Tables

`uploaded_files` (see `docs/database/schema.md`).

## Frontend

Canvas toolbar's image tool uploads via this API and inserts the returned URL into the object's `data`.

## Status

Complete for local disk. Object storage (R2) provider is a launch-checklist item (P0) — the `provider` column and `StorageProvider` interface were designed for swapping without migration.

## Gaps

- No size/type enforcement beyond API validation; no virus scanning (launch item).
- `/uploads/*` static serving is dev-only — production must serve from object storage.