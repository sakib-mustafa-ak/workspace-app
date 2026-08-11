# Database Schema

ORM: Drizzle ORM against PostgreSQL. Schema source of truth lives in `packages/database/src/schema` (one folder per aggregate). All indexes, constraints and enums are declared in code and applied via migrations (`drizzle-kit`).

## Conventions

- **IDs:** UUIDv7, generated client-side via `PRIMARY_ID()` (time-ordered, index-friendly).
- **Timestamps:** `created_at` / `updated_at` always present (`timestamptz`, UTC). `updated_at` is touched on every write via `TOUCH_UPDATED_AT_SQL`.
- **Soft delete:** optional `deleted_at` used selectively (users, workspaces, boards, columns, tasks, comments, canvas, canvas objects, uploads, memberships). Never on sessions, invitations or tokens — those are hard-deleted by sweep jobs.
- **Status + timestamps consistency:** CHECK constraints enforce e.g. `archived_at IS NULL OR status = 'ARCHIVED'`.
- **Unique indexes are partial** where soft-delete is involved (e.g. unique slug only among live rows).
- **Enums** are Postgres `pgEnum` types (see below).

## Tables (18)

### users
Identity-defining fields: `display_name`, `email` (unique), `password_hash`, `status`, `avatar_url`, `bio`, `timezone`, `locale`, `last_login_at`, `email_verified_at`. Password hashes also live on `users` today; `identities.password_hash` is the forward-looking home.

### identities (`auth`)
`User × Provider` binding for future OAuth: `provider` (`EMAIL`, `GOOGLE`, `GITHUB`, `MICROSOFT`, `APPLE`), `provider_user_id`, `email_for_oauth`, `password_hash`, `is_primary`, `last_used_at`. Unique per (user, provider) and per (provider, provider_user_id) when non-null.

### sessions (`auth`)
Refresh-token sessions: `refresh_token_hash` (unique; plain token never stored), `device_name`, `user_agent`, `ip_address` (inet), `public_keys` (JSONB, reserved for WebAuthn), `last_used_at`, `expires_at`, `revoked_at`. Not soft-deleted; purged by retention job.

### email_verification_tokens (`auth`)
`selector` + `verifier_hash` (SHA-256, verifier never stored), `consumed_at`, `expires_at`. Hard-deleted after use/expiry.

### password_reset_tokens (`auth`)
Same selector/verifier model; `requested_from_ip`, `user_agent`, `consumed_at`, `expires_at`. Hard-deleted after use/expiry.

### workspaces
Multi-tenancy root: `name`, `slug` (unique among live rows), `owner_id` → users (restrict), `status`, `description`, `logo_url`, `website`, `settings`, `archived_at`. CHECK: name 3–80 chars, slug `^[a-z0-9]+(-[a-z0-9]+)*$` ≤ 32.

### workspace_members
`workspace_id` + `user_id` (unique among live rows, cascade delete), `role`, `status` (PENDING/ACTIVE/SUSPENDED/REMOVED), `joined_at` (null only when PENDING), `invitation_id` audit link. Ownership is enforced in service layer, not DB.

### invitations
`workspace_id`, `email`, optional `invitee_id`, `role`, `status` (PENDING/ACCEPTED/EXPIRED/REVOKED), `selector` (unique), `verifier_hash`, `invited_by_id`, `accepted_by_id`, `accepted_at`, `expires_at`, `revoked_at`. Not soft-deleted.

### boards
`workspace_id` → workspaces (restrict), `name`, `description`, `position` (unique per workspace among live rows), `status` (ACTIVE/ARCHIVED), `archived_at`.

### board_columns
`board_id` → boards (cascade), `name`, `position` (unique per board), `status` (ACTIVE/ARCHIVED), `archived_at`.

### tasks
`workspace_id`, `board_id`, `column_id` (all restrict), `title`, `description`, `position`, `status` (BACKLOG/TODO/IN_PROGRESS/IN_REVIEW/DONE/CANCELLED), `priority` (NONE/LOW/MEDIUM/HIGH/CRITICAL), `assignee_id` → users (set null), `created_by_id` (restrict), `due_date`, `completed_at` (CHECK: only when DONE). Indexed on workspace, board, column, assignee, status.

### checklist_items
`task_id` → tasks (cascade), `text`, `completed` (default false), `position`.

### canvas
One per board: `board_id` (cascade), `workspace_id` (restrict), `name` (default `Canvas`).

### canvas_objects
`canvas_id` (cascade), optional `parent_id`, `type` (RECTANGLE/ELLIPSE/TEXT/STICKY_NOTE/IMAGE/ARROW/LINE/PATH/FRAME/CONNECTOR), `status`, geometry: `x`, `y`, `width`, `height`, `rotation`, `z_index`; style: `fill`, `stroke`, `stroke_width`, `opacity`; `data` JSONB (text content, image metadata, path data; length-bounded), `created_by_id`, `archived_at`. Indexed on canvas, parent, type, z_index.

### board_comments
`board_id`, `workspace_id`, optional `parent_id` (threaded replies), `content` (min length enforced), `user_id`, `edited_at`.

### notifications
`user_id` (cascade), `type` (COMMENT_ADDED, BOARD_SHARED, WORKSPACE_UPDATED, MENTION_CREATED, MEMBER_ADDED, INVITATION_ACCEPTED, TASK_ASSIGNED, FILE_UPLOADED), `channel` (IN_APP/EMAIL), `status` (CREATED/QUEUED/DELIVERED/READ/ARCHIVED), `title`, `body`, `resource_type`, `resource_id`, `read_at`, `delivered_at`, `archived_at`.

### uploaded_files
`workspace_id` (restrict), optional `board_id` (set null), `user_id` (restrict), `original_name`, `mime_type`, `size`, `storage_key`, `url`, `provider` (default `local`).

### audit_events
Immutable activity log: `workspace_id` (cascade), `user_id` (restrict), `action`, `resource_type`, `resource_id`, `metadata` (JSONB).

## Enums

| Enum | Values |
| --- | --- |
| `user_status` | ACTIVE, INACTIVE, SUSPENDED, DELETED |
| `identity_provider` | EMAIL, GOOGLE, GITHUB, MICROSOFT, APPLE |
| `workspace_status` | ACTIVE, ARCHIVED, DELETED |
| `workspace_role` | VIEWER, COMMENTER, EDITOR, ADMIN, OWNER (ranked) |
| `membership_status` | PENDING, ACTIVE, SUSPENDED, REMOVED |
| `invitation_status` | PENDING, ACCEPTED, EXPIRED, REVOKED |
| `board_status` | ACTIVE, ARCHIVED |
| `column_status` | ACTIVE, ARCHIVED |
| `task_status` | BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED |
| `task_priority` | NONE, LOW, MEDIUM, HIGH, CRITICAL |
| `canvas_object_type` | RECTANGLE, ELLIPSE, TEXT, STICKY_NOTE, IMAGE, ARROW, LINE, PATH, FRAME, CONNECTOR |
| `canvas_object_status` | ACTIVE, ARCHIVED |
| `notification_type` | COMMENT_ADDED, BOARD_SHARED, WORKSPACE_UPDATED, MENTION_CREATED, MEMBER_ADDED, INVITATION_ACCEPTED, TASK_ASSIGNED, FILE_UPLOADED |
| `notification_channel` | IN_APP, EMAIL |
| `notification_status` | CREATED, QUEUED, DELIVERED, READ, ARCHIVED |

## Key relationships

- `users` ← `identities`, `sessions`, tokens, uploads, comments (creator FKs)
- `workspaces` → `workspace_members`, `invitations`, `boards`, `tasks`, `canvas`, `uploaded_files`, `audit_events` (rolled-up)
- `boards` → `board_columns`, `tasks`, `canvas` (1:1), `board_comments`
- `boards`/`board_columns` → `tasks` (a task belongs to exactly one column at a time; `column_id` is the live position, `position` orders within the column)

Full design rationale: `docs/domain/domain-model.md`, `docs/domain/02-entities.md`, `docs/domain/03-relationships.md`.