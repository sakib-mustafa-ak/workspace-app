# Uptime Monitoring — Workspace OS

How to monitor the API for availability using an external uptime service
(UptimeRobot, Betterstack, Stakker, etc.). Covers the health endpoint contract
and the recommended — **keyword-based** — monitor configuration.

## Health endpoint

| | |
|---|---|
| URL | `GET {API_BASE_URL}/api/v1/health` |
| Auth | none (`@Public()`) |
| Status | **always 200** (liveness — the process is up and serving requests) |
| Content-Type | `application/json` |

The endpoint is intentionally **liveness-first**: it returns `200` even when the
database is unreachable. That keeps an external uptime monitor from pageing on a
transient DB hiccup — DB/integration state is in the body, not the status code.
This is a deliberate trade-off (see `HealthService.getHealth` in
`apps/api/src/modules/health/health.service.ts`). Do NOT "fix" it to return 503
when the DB is down, or transient read-replica / reconnect blips will page you.

Production example: `https://workspace-api-8387.onrender.com/api/v1/health`.

### Response body

```json
{
  "status": "ok",
  "service": "workspace-api",
  "version": "0.1.0",
  "uptime": 1234.5,
  "timestamp": "2026-09-03T00:00:00.000Z",
  "checks": {
    "database": { "status": "up", "latencyMs": 4 },
    "integrations": [
      { "name": "storage", "configured": true,  "provider": "vercel-blob" },
      { "name": "email",   "configured": true,  "provider": "resend"     },
      { "name": "billing", "configured": false, "provider": "not configured" }
    ]
  }
}
```

Key fields for monitoring:
- `checks.database.status` — `"up"` (DB reachable, ping < 2s) or `"down"`.
- `checks.integrations[].configured` — true when the provider is actually wired
  (storage not `local`, Resend key present, Stripe key present). A `false` here
  is a **configuration** signal, not an outage — the app still runs.

## Keyword-based monitoring (recommended, explicit)

Because the endpoint **always returns HTTP 200**, a status-code check is
meaningless — a 200 tells you nothing about the app. Configure the external
monitor to assert an expected **keyword in the response body** instead:

- Assert the body **contains** the keyword `"status":"ok"` (or the literal
  `ok`).

This is the one reliable liveness signal the endpoint exposes. Every monitor
configured against this endpoint should be keyword-based.

### Monitor settings (UptimeRobot example)

| Setting | Value |
|---|---|
| Monitor type | **HTTP(s)** |
| URL | `https://workspace-api-8387.onrender.com/api/v1/health` |
| Keyword | `"status":"ok"` |
| Keyword type | **Contains** (exists/lookup) |
| Interval | 5 min (> 60s to avoid hitting fetch limits) |
| Alert contacts | ops on-call; `@pagerduty` or email/SMS depending on provider |

Betterstack / Stakker equivalent: add a keyword condition matching the body, not
just "HTTP 200".

### Recommended secondary monitors

- **Integration config drift** (optional): a second keyword monitor that asserts
  `"configured":true` for `storage` and `email` once those providers ship to prod.
  Use it to catch a half-applied env deploy (e.g. storage silently fallen back to
  `local`). Skip until those providers are actually configured in prod — a
  configured=false alarm before then is noise.

### What NOT to watch

- The raw HTTP status code (always 200 — see above).
- `checks.database.status === "down"` on a status-code basis (liveness keeps
  200). If you want DB-down paging, add it as its own **keyword** monitor looking
  for `"down"`, and accept that network jitter between the monitor and the DB can
  cause false positives. Given the 2s ping timeout, prefer not to page on this —
  let Sentry + logs surface DB issues.

## Provisioning this monitor

Provisioning the actual account + monitor is a **deploy-time** step, not done in
this repo. Outline:
1. Create an UptimeRobot (or Betterstack) account.
2. Add the HTTP(s) monitor above (keyword `"status":"ok"`, contains).
3. Wire alert contacts (email/SMS/PagerDuty/Slack webhook).
4. Set the prod API URL from your deploy env (example above is a placeholder
   that assumes Render; replace with the real domain once deployment is decided).

## Related

- Checklists: `docs/launch-checklist.md` → Observability (uptime + Sentry items).
- Sentry setup: `apps/api/src/infrastructure/sentry/*` (API) and
  `apps/web/sentry.*` (web) — error tracking, driven by `SENTRY_DSN`.
- Health implementation: `apps/api/src/modules/health/{health.service.ts,
  health.controller.ts}` and their specs.