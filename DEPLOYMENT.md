# Deployment Guide — Workspace OS

Live URL stack (all free tiers): **Vercel** (Next.js web) + **Render** (NestJS API)
+ **Neon** (PostgreSQL) + Upstash (Redis, optional — reserved for future use).

Why this stack: the web pulls `NEXT_PUBLIC_API_URL` from env for both REST
(`lib/api.ts`) and socket.io (`lib/canvas-socket.ts`), so the two apps are
independent deploys joined by one env var. Render keeps the NestJS runtime
(tsx loader, socket.io WebSockets) native; Neon is a managed Postgres that
speaks the same `postgresql://` URL the Drizzle driver already uses.

## One-time setup (browser, ~20 min)

### 1. GitHub
- Push the repo: `git remote -v` should show your origin; run
  `git push -u origin main` if not.

### 2. Neon (database)
1. https://neon.tech → Sign in (GitHub) → **Create a project** (any region).
2. Copy the **connection string** from the dashboard — it looks like
   `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`.
   (The `sslmode=require` suffix matters — the Neon server rejects plain
   connections.)
3. Keep it for Render below.

### 3. Render (API)
1. https://render.com → Sign in (GitHub).
2. **New → Blueprint** → pick `sakib-mustafa-ak/workspace-app`.
3. Render reads `render.yaml` at the repo root. It creates a free web service
   named `workspace-api` automatically running the migration then the app.
4. Before the first build finishes, open the service → **Environment**:
   - `DATABASE_URL` → paste the Neon connection string.
   - `APP_PUBLIC_BASE_URL` → `https://<your-app>.vercel.app`
     (fill after step 4, or set later and redeploy).
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` → Render generated them
     (check they exist; each ≥16 chars).
   - Save → **Manual Deploy → Latest commit** if a build already started.
5. The current service URL is `https://workspace-api-8387.onrender.com`. Verify:
   `curl https://workspace-api-8387.onrender.com/api/v1/health` → 200.

### 4. Vercel (web)
1. https://vercel.com → Sign in (GitHub) → **Add New Project** →
   `workspace-app`. Framework auto-detected as **Next.js**.
2. **Danger zone setting**: under Settings → General → Root Directory,
   select **`apps/web`** (the monorepo).
3. Environment Variables (add `NEXT_PUBLIC_API_URL`):
   `https://workspace-api-8387.onrender.com/api/v1`
4. Deploy. The current site is `https://workspace-app-web.vercel.app`.

### Releasing workspace home, board access and events

These changes require both the web and API deployments, plus database migrations:

1. Include all new source files, SQL migrations and migration metadata in the commit.
2. Deploy the API on Render. Its build command in [render.yaml](render.yaml)
   builds the shared packages and API, then runs `drizzle-kit migrate`.
   Confirm the actual Render service uses that command; changing this file alone
   does not prove an existing service's dashboard settings have been updated.
3. Confirm migrations `0008_handy_timeslip` (board access) and
   `0009_chief_living_tribunal` (personal events) complete against the same Neon
   database the API uses. Do not use schema push or reset on production.
4. Confirm API health is 200 and an unauthenticated request to
   `/api/v1/events` returns 401, not 404. Then test events while signed in.
5. Deploy/redeploy Vercel with the production API URL above. If Vercel auto-deploys
   first, wait for Render to finish before testing the new features. Verify both
   services target the intended main-branch commit.
6. Smoke-test sign-in, workspace/board creation, event create/edit/delete, task
   assignment, restricted-board visibility and two-tab canvas collaboration.
   Changing access on one board must not disconnect another board's canvas.

The migrations add a nullable column and a new table; existing boards remain
visible to workspace members by default. Integration tests use an isolated
database and do not apply migrations to Neon or send real verification emails.

### 5. Smoke test
- Configure real email using the Gmail API or Resend instructions below before
  deploying the authentication changes; otherwise production startup will fail.
- Register a new account in the UI (signup is open; the DB is empty).
- Create a workspace → board → switch to the Pencil tool and draw on a
  second browser tab; strokes sync in real time.
- Check the API logs tab in Render for errors.

## Env var inventory

### Workspace plugins

Plugin add-ons and integrations require migrations through `0011_account_plugins`
and matching API/web deployments. Plugins are enabled or connected once per
account, across all accessible workspaces, from dashboard Plugins. Migration
preserves enabled add-ons and unambiguous existing personal connections; multiple
old connections for the same provider require reconnecting once. Integration credentials are optional: unconfigured
connectors remain disabled without blocking the rest of the app. Follow the
[workspace plugins setup guide](docs/plans/workspace-plugins.md) for GitHub,
Slack, Google Calendar, encryption keys and callback URLs. Custom extensions
are listed as Coming soon.

| Variable | Where | Value |
|---|---|---|
| `DATABASE_URL` | Render | Neon connection string with `?sslmode=require` |
| `APP_PUBLIC_BASE_URL` | Render | `https://<app>.vercel.app` |
| `MAIL_PROVIDER` | Render only | `gmail` for Gmail HTTPS API; `resend` for Resend |
| `GMAIL_USER` | Render only | `workspace.os.verify@gmail.com` (Gmail option) |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` | Render only | Private sender OAuth credentials; see Gmail setup below |
| `RESEND_API_KEY` | Render only | Secret Resend sending API key; never expose through `NEXT_PUBLIC_*` |
| `MAIL_FROM` | Render only | Resend: verified-domain sender. Gmail: omit or use `Workspace OS <workspace.os.verify@gmail.com>` |
| `JWT_ACCESS_SECRET` | Render (generated) | random ≥16 chars |
| `JWT_REFRESH_SECRET` | Render (generated) | random ≥16 chars |
| `NEXT_PUBLIC_API_URL` | Vercel | `https://workspace-api-8387.onrender.com/api/v1` |
| `REDIS_HOST` / `REDIS_PORT` | optional | defaults `localhost`/`6379`; the Redis module is a no-op placeholder — no client connects yet |

## Known limits (free-tier demo)

Production requires real email configuration at startup. Configure either Gmail API or Resend **before deploying this change**, or the API will refuse to start instead of silently recording email. Existing unverified accounts must verify before accessing workspace APIs or realtime connections. Email configuration alone does not require a new migration; workspace home, board access and events require the migrations listed above.

### Activate email and verification

**No domain / Render free:** use the [Gmail HTTPS API setup guide](docs/plans/gmail-api-setup.md).
It sends through `workspace.os.verify@gmail.com` using sender-only OAuth credentials.
Your Google App Password is not used. Render free blocks SMTP ports, so Gmail SMTP
is not suitable for this deployment. OAuth apps left in Testing have refresh tokens
that normally expire after seven days; follow the publishing/reauthorization guidance.

**Resend alternative (requires a sending domain):**

For a no-cost local prototype and fake-domain signup filtering, see [the local verification lab](docs/plans/local-email-verification.md). This is simulated delivery, not a public Postal/BillionMail server. Do not enable its inbox in production.

1. Add a domain you own in Resend and publish the DNS records Resend provides. Wait for its verified status. See [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction). Prefer a transactional subdomain; keep open/click tracking disabled for authentication links.
2. Create a sending API key and enter it directly into Render's secret environment settings as `RESEND_API_KEY`. Set `MAIL_FROM` to an address on that verified domain. Do not paste the key into chat, commit it, or put it in Vercel public environment variables.
3. Set `MAIL_PROVIDER=resend` and `APP_PUBLIC_BASE_URL` to the web application's public HTTPS origin, not the API URL. Redeploy both API and web. The Render blueprint defaults to Gmail; override that selection for Resend. Existing services need their Environment settings updated manually.
4. Register a fresh account using an inbox you control. Confirm an email arrives, confirm the link opens the correct deployment, click **Verify my email**, and then enter your workspace. An unverified account must receive `AUTH.EMAIL_NOT_VERIFIED` on protected APIs.
5. Check resend, an expired/used link, and password reset. Resending invalidates previous verification links. The public resend response does not reveal whether an account exists. If signup delivery fails, the account stays created and the user can resend from the check-email page.

Development/test without a configured provider use an in-memory recorder, not real email. Automated transport tests mock Google HTTPS calls or the Resend SDK; they do not prove live inbox delivery. Check actual delivery after configuring the selected provider's credentials.

Verification checks: `corepack pnpm --filter api test -- --runInBand` and, after building the shared database package and API, `corepack pnpm --filter api test:email-integration`. The latter uses an isolated PGlite database and a recording transport; it never sends real email or connects to the configured production database.

- **Uploads are ephemeral.** Files land on Render's local disk
  (`apps/api/uploads`) and vanish on every deploy/restart. Acceptable for a
  demo; swap `LocalStorageProvider` for R2/S3 before real use.
- **Render free instance sleeps** after ~15 min idle; the first request after
  sleep takes ~30 s to spin up. Faculty demo: open the site before the talk.
- **Vercel rewrites** in `apps/web/next.config.js` pointing at
  `localhost:4000` (`/api/*`, `/uploads/*`) are dev-only conveniences — the
  production client uses the absolute `NEXT_PUBLIC_API_URL` and never hits
  them. Leave them for local dev.
- **One API instance** — socket.io works fine on a single instance.
  Multi-instance scaling requires the Redis adapter (sticky sessions),
  tracked for later.
