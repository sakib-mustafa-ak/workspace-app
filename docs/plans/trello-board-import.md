# Trello board import

## Plan

1. Accept a single-board Trello JSON export from the workspace Boards page. No Trello credentials or new deployment secrets are needed.
2. Validate on the server and return a read-only preview before confirmation. Limit exports to 5 MB, 100 lists, 2,000 cards and 10,000 checklist items.
3. Create a new board using existing tables in one transaction. Preserve list/card/checklist ordering, descriptions, due dates and checklist completion. Cards with `dueComplete` become DONE; no completion timestamp is invented. Multiple checklists are flattened with their names as prefixes.
4. Skip archived lists/cards. Explain exclusions in the preview: members, labels, comments, attachments, custom fields, automations and history. No attachments or remote URLs are fetched.
5. Require EDITOR or higher, enforce the board plan limit, allocate a free board position, and publish the normal board-created event only after commit. Failed imports leave no partial board.
6. Add parser/service tests and run type checking, lint and builds. Check the upload/preview/confirmation UI with mocked API responses where possible.

## Scope and operational notes

- Existing native Workspace OS imports remain unchanged.
- This is a one-time copy, not a live sync. Reimporting creates another board; check the board list before retrying an interrupted request.
- No schema migration or external integration configuration is required. Deploy the API and web changes together.
- Trello export instructions: https://support.atlassian.com/trello/docs/exporting-data-from-trello/
- Real exported data should be treated as private; do not log uploads or commit user exports.

## Implemented and verified

- Protected preview and import endpoints: `POST /api/v1/workspaces/:workspaceId/boards/trello/preview` and `/trello/import`, with a `{ "board": <export object> }` body.
- Boards page upload dialog includes counts, list preview, exclusions, file errors and explicit confirmation. An uncertain network result disables resubmission and asks the user to check boards first.
- Import transactions serialize per workspace. Membership and quota checks use the same transaction connection to avoid connection-pool starvation while concurrent imports wait on the lock.
- API unit tests cover parsing, ordering, completion, malformed data, permissions, limits and failed writes.
- Disposable PGlite integration check uses actual migrations, repositories and billing policy. It verifies preview is read-only, persisted mappings, membership rejection, the free board limit, and rollback when the final checklist insert fails. Build shared packages and the API, then run `corepack pnpm --filter api test:trello-integration`.
- Browser checks with mocked API responses verified invalid JSON, read-only preview, a single confirmation request, the imported board appearing, uncertain-result protection, a 375-pixel mobile layout and keyboard focus wrapping. No real Trello account or production data was used.
