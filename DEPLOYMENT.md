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
5. The service URL is `https://workspace-api-m9q7.onrender.com`. Verify:
   `curl https://workspace-api-m9q7.onrender.com/api/v1/health` → 200.

### 4. Vercel (web)
1. https://vercel.com → Sign in (GitHub) → **Add New Project** →
   `workspace-app`. Framework auto-detected as **Next.js**.
2. **Danger zone setting**: under Settings → General → Root Directory,
   select **`apps/web`** (the monorepo).
3. Environment Variables (add `NEXT_PUBLIC_API_URL`):
   `https://workspace-api-m9q7.onrender.com/api/v1`
4. Deploy. The site comes up at `https://workspace-app.vercel.app`.

### 5. Smoke test
- Register a new account in the UI (signup is open; the DB is empty).
- Create a workspace → board → switch to the Pencil tool and draw on a
  second browser tab; strokes sync in real time.
- Check the API logs tab in Render for errors.

## Env var inventory

| Variable | Where | Value |
|---|---|---|
| `DATABASE_URL` | Render | Neon connection string with `?sslmode=require` |
| `APP_PUBLIC_BASE_URL` | Render | `https://<app>.vercel.app` |
| `JWT_ACCESS_SECRET` | Render (generated) | random ≥16 chars |
| `JWT_REFRESH_SECRET` | Render (generated) | random ≥16 chars |
| `NEXT_PUBLIC_API_URL` | Vercel | `https://workspace-api-m9q7.onrender.com/api/v1` |
| `REDIS_HOST` / `REDIS_PORT` | optional | defaults `localhost`/`6379`; the Redis module is a no-op placeholder — no client connects yet |

## Known limits (free-tier demo)

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