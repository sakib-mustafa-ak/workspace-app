# Feature: Workspaces

The workspace is the multi-tenancy boundary: every board, task, canvas, comment, upload and audit event rolls up to one workspace.

## What it does

- Create workspaces (creator becomes the OWNER member; one OWNER per workspace, transferable).
- Invite members by email via selector/verifier invitations; accept/reject; expire or revoke.
- Role-based access: VIEWER < COMMENTER < EDITOR < ADMIN < OWNER (ranked comparisons via `WORKSPACE_ROLE_RANK`).
- Member management: list, change role, remove (OWNER cannot be removed except via transfer).
- Archive/unarchive; soft delete.
- Pending invitations list for a user across all workspaces.

## Endpoints

See `docs/api/routes.md` — all `/workspaces*` routes.

## Tables

`workspaces`, `workspace_members`, `invitations` (see `docs/database/schema.md`).

## Permission model

- The OWNER grant is enforced in the service layer: exactly one OWNER membership per workspace at any time.
- Authorization decisions go through policies (`modules/workspaces/policies`), never raw role string comparisons in controllers.
- Members can only see contents of workspaces they belong to; searching and listing are scoped accordingly.

## Invitation flow

1. ADMIN+ invites by email → `invitations` row with `selector` (public, unique) + `verifier_hash`.
2. Invitee accepts with selector + verifier → membership created (status ACTIVE, `joined_at` set) and invitation marked ACCEPTED, in one transaction.
3. Expired/revoked invitations are terminal; rows are kept for audit then purged by a sweep.

## Status

Complete. Pending invitations surface in the web app's workspace UI.