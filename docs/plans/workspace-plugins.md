# Workspace plugins

## Delivered scope

Choose **Plugins** from the dashboard header or navigation. The dashboard hub
has no workspace selector: installations belong to the signed-in account and
apply across all current and future workspaces that account can access. Existing
workspace plugin URLs redirect to the account hub. OAuth returns there as well.
The hub contains:

- **Time tracking:** each person enables it once; editors and above start/stop their
  own task timer. One active timer per person per workspace. The task modal
  displays that person's recorded time, refreshed every 30 seconds. Timers
  continue while the browser is closed. Disabling tracking stops your timers in all workspaces
  and preserves entries. Anyone can stop their own timer from the hub, even
  after losing access to its board. Time entry task names are not exposed there.
- **Task voting:** one vote per person per task, removable and idempotent. Active
  members with board access, including viewers, may vote. Disabling preserves
  votes but prevents further changes and hides the controls.
- **GitHub:** OAuth connection, up to 30 public repositories and open issues.
  Private repositories and pull requests are excluded. No code writes, issue
  imports, webhooks or background synchronization.
- **Slack:** OAuth bot installation, up to 100 public channels and an explicit
  message composer. Bot scopes are `channels:read` and `chat:write`. The bot must
  be invited to the selected channel. No private-channel/message reads, automatic
  task forwarding, mention expansion or link previews.
- **Google Calendar:** read-only upcoming events from your connected account's
  primary calendar, up to 30. Uses `calendar.events.readonly`; does not write,
  import or synchronize events with the dashboard's personal events.
- **Custom extensions:** visible as **Coming soon**, disabled in the UI and
  rejected by the API. No arbitrary scripts, uploaded plugins or embedded apps
  are executed.

Every verified user manages their own plugins through `/api/v1/plugins`, with one
connection per provider per account. No workspace role is required to connect a
personal provider. Other members, including workspace admins, cannot read,
modify, or disconnect your connection. Enabling an add-on affects only you, not
your teammates. Task voting and tracking still enforce active membership and
actual board access; tracking still requires an editor role. Global installation
never grants access to another team's tasks, private boards, or provider account.
The hub can stop your timers across all workspaces even after membership loss.

Migration `0011_account_plugins` creates account settings and OAuth state tables.
Enabled legacy add-ons are preserved for active members. A single unambiguous
provider connection migrates to its connecting account if that user is still an
active owner/admin of the source workspace. The encrypted token's old context is
preserved until first use, then replaced by account-scoped encryption. Multiple
legacy connections for the same person/provider require reconnecting in the hub;
we do not silently choose an account. Legacy rows, recorded time, and votes are
retained. In-progress old OAuth requests must be restarted. Never roll back only
the API after migration, since old workspace settings are no longer authoritative.

## OAuth setup on Render

Existing deployments remain usable without any connector credentials: add-ons
work and connector buttons say **Server setup required**. No new paid service is
required by the implementation; provider account/publishing policies still apply.

1. Apply migrations through `0011_account_plugins` through the existing Render build
   command (`pnpm --filter @repo/database exec drizzle-kit migrate`). Do not reset
   or schema-push production. Deploy API and frontend together after migration.
2. Set `APP_PUBLIC_BASE_URL=https://workspace-app-web.vercel.app` on Render (or
   your actual frontend origin). OAuth redirects point to the frontend, not API.
3. Generate a 32-byte encryption key locally and save it as
   `PLUGIN_TOKEN_ENCRYPTION_KEY` on Render:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Keep this key stable and backed up privately. Changing it makes saved tokens
   unreadable; disconnect/reconnect accounts if it is replaced. Never put any
   plugin secret in a `NEXT_PUBLIC_*` variable, source control, screenshots or chat.
4. Create provider developer applications and configure the exact callback URLs:

   | Provider | Render variables | Callback |
   | --- | --- | --- |
   | GitHub OAuth App | `PLUGIN_GITHUB_CLIENT_ID`, `PLUGIN_GITHUB_CLIENT_SECRET` | `https://workspace-app-web.vercel.app/plugins/callback/github` |
   | Slack App | `PLUGIN_SLACK_CLIENT_ID`, `PLUGIN_SLACK_CLIENT_SECRET` | `https://workspace-app-web.vercel.app/plugins/callback/slack` |
   | Google OAuth web client | `PLUGIN_GOOGLE_CLIENT_ID`, `PLUGIN_GOOGLE_CLIENT_SECRET` | `https://workspace-app-web.vercel.app/plugins/callback/google-calendar` |

   - GitHub: developer settings → OAuth Apps. No repository write scope is
     requested. Use a dedicated app to avoid prior broad authorizations.
   - Slack: OAuth & Permissions → redirect URLs and Bot Token Scopes. Add only
     `channels:read` and `chat:write`. Leave token rotation disabled for the
     simplest setup; expiring tokens with refresh tokens are supported. Invite
     the bot to a public channel before sending. Sending is user-initiated.
   - Google Cloud: enable **Google Calendar API**, configure the consent screen
     and add the read-only events scope. Add the connecting Google account as a
     test user while the app is in Testing. Use separate credentials from the
     existing Gmail verification sender. Testing-mode refresh tokens may expire;
     follow Google's publishing rules before general use.
5. Redeploy Render, then deploy the matching web build to Vercel. No new frontend
   secret variables are needed; retain the existing `NEXT_PUBLIC_API_URL`.
6. From dashboard Plugins, choose Connect, review provider permissions, and finish
   the connection in the **same tab**. Requests expire in ten minutes. Cancelling,
   logging in with another Workspace OS account or reloading a stripped callback
   requires starting the connection again.

Disconnect removes local tokens and pending grants. It does not revoke the
provider authorization or uninstall the Slack bot; use the provider's app access
settings to do that. This is stated in the confirmation dialog.

## Security and persistence

Tokens are stored server-side as AES-256-GCM ciphertext with account and provider
authenticated context. OAuth state is random, hashed in the
database, expires and is consumed atomically. The browser also checks the
same-tab state; completion requires the initiating authenticated user. GitHub
and Google flows use PKCE. Callback queries are removed, marked no-referrer and
excluded from callback-page telemetry. Hosting-provider request logs can still
contain initial callback URLs: restrict log access and retention.

Provider hosts are fixed, requests time out after 15 seconds, redirects are not
followed, and errors omit provider bodies. Refresh tokens persist even when a
downstream provider request fails. Per-plugin row locks serialize connect,
disconnect and use; background jobs and arbitrary URL fetching are not enabled.
Workspace role and actual task/board access are checked server-side, before
returning task add-on data. A unique partial index prevents duplicate running
timers; unique task/user votes prevent repeated votes.

## Verification

```powershell
corepack pnpm --filter @repo/database build
corepack pnpm --filter api build
corepack pnpm --filter api test:plugins
corepack pnpm --filter @repo/database check-migrations
corepack pnpm lint
corepack pnpm check-types
corepack pnpm build
```

The plugin integration check applies all migrations to a disposable PGlite
database and runs real HTTP DTO, workspace-role and board-access checks using
test identities instead of JWT. Provider HTTPS responses are mocked; it sends no
real Slack messages and cannot certify a deployed OAuth app's configuration.
Also run the normal API unit suite for JWT/verification behavior. Before release,
smoke-test each live provider with a test account and a test Slack channel.

Official protocol references:

- [GitHub authorization flow and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub scope permissions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [Slack OAuth v2 token exchange](https://docs.slack.dev/reference/methods/oauth.v2.access/)
- [Slack chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage/)
- [Google web-server OAuth and token refresh](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Calendar events.list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
