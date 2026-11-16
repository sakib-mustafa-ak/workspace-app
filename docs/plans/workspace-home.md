# Simpler workspace home and board access

## Experience

- The global sidebar and mobile bottom navigation appear only on `/dashboard`.
  Other authenticated pages have a compact back-to-dashboard/workspace bar.
- `/workspaces/:id` and `/workspaces/:id/boards` show the same workspace home.
- The left list contains open tasks assigned to the signed-in user, due today or
  overdue, across boards they can access. Browser timezone offset defines today.
  Critical, high, medium, low, then no priority; ties use earliest due date and ID.
  Up to 200 tasks are shown, with an explicit limit notice.
- The right list has searchable boards, inline board creation and Trello import.
  Hover previews or the keyboard/touch chevron show three open priority tasks.
  Tasks open the existing editor directly. Canvas links are one click away.
- Circular initials show actual connected canvas users, deduplicated across tabs.
  The home polls every 15 seconds while visible and refreshes on window focus.
  Visiting the home does not join canvas rooms or inflate presence.
- Owners/admins have an always-visible lock button for board access. Members,
  invitations and workspace settings remain under Manage. Archives and board
  deletion remain in Board library & archives.

## Authorization

`boards.access_user_ids` is nullable JSONB: null means all active workspace members,
an empty list means owner/admin only, and a UUID list grants those active members
access. Workspace role still limits edits; granting access never upgrades a role.
Only owners/admins can change grants, and grants must belong to this workspace.

The global board guard checks the real board behind child IDs and rejects forged
parent paths. It covers tasks, columns, comments, checklists, canvas, AI summaries,
exports and board-specific file routes. Multipart uploads validate access in the
service after parsing. Cross-board lists, search, global task lists, file lists and
notifications filter visibility before pagination or link generation.

Workspace-wide audit activity is now admin-only because its metadata can contain
private-board content. Already downloaded data cannot be recalled; previously
issued storage URLs remain valid until their normal expiration.

Board grant changes invalidate websocket permission caches, remove room membership,
clear canvas presence and release locks. Canvas clients receive an access-changed
message and must reload. In-flight cache lookups are rejected if access changed
while they were pending. Presence remains correct when one of multiple tabs closes.

## Deployment

Migration `0008_handy_timeslip.sql` adds one nullable column without rewriting or
deleting existing boards. Existing boards remain shared. Apply migrations before
starting the new API; the Render build already runs the migration command.
No production database was changed during implementation. Do not deploy only the
frontend: the new workspace home requires the updated API and migration.

## Validation

Upcoming appears below My Day and returns the next ten open tasks assigned to
the current user, due from tomorrow in the browser's timezone offset. Tasks are
ordered by due date, then priority. Today/overdue tasks, undated tasks, completed
or cancelled tasks, archived boards and inaccessible boards are excluded. The
list uses the same refresh and task-details flow as My Day.

### Local PGlite socket server

Keep the database, API and web tasks running. The Local Workspace API task opts
in to `LOCAL_PGLITE=true`. On development loopback connections to port 5433 only,
this limits postgres-js to one connection: the socket adapter shares a single
PostgreSQL session and concurrent connections can corrupt unnamed statement
bindings. Production and all other database URLs keep the existing pool of ten.
Restart the API task after rebuilding the database package to apply the setting.
Board creation must reuse its transaction executor for the position lookup so
it does not deadlock waiting for another pooled connection.

- Root lint, types, and production builds.
- API unit tests including access rules, presence and socket revocation.
- `corepack pnpm --filter @repo/database check-migrations` uses a disposable DB.
- After building database/API: `corepack pnpm --filter api test:workspace-home`.
  This tests actual migrations/SQL, default compatibility, membership grants,
  today tasks, priority ranking, search/files/notification filtering and forged
  parent requests using PGlite. It never uses production data or sends mail.
- Desktop/mobile browser interaction tests use local synthetic data; these are
  UI checks, not proof of live multi-user network delivery.
