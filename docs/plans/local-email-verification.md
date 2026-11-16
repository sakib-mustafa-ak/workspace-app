# Local email verification prototype

## Scope

This lab exercises the application's real signup, hashed verification tokens and verified-account guard. It captures emails locally instead of delivering them. It is not a Postal/BillionMail deployment and does not need a domain, Docker, a paid mail account or an external database. A real self-hosted mail server remains a separate deployment step.

## Start the standalone lab

From the repository root:

```powershell
corepack pnpm --filter @repo/database build
corepack pnpm --filter api build
corepack pnpm --filter api dev:verification
```

Open http://127.0.0.1:4010. The server binds only to loopback, ignores environment-file credentials and creates a disposable PGlite database in memory. Stop it with Ctrl+C; its accounts, sessions, messages and signing keys disappear. Restarting starts a new lab. It never uses the configured production database or sends email.

1. Try the reported fake address `asdas@kdasf.csid`: its nonexistent domain should be rejected. Temporary DNS failures return a retryable error rather than creating an account or labelling the address invalid.
2. Enter an address on a mail-capable domain, a test name and a new test-only password. Do not reuse a real password.
3. Create the account. Try **Check protected access**: the account is authenticated but must be blocked until verified.
4. Select the captured verification email, then click **Verify selected email link**.
5. Check protected access again: it should now be allowed.

**Important:** Anyone using a simulated inbox can read its captured links. This proves only that the application workflow works. It does not prove ownership or existence of a real mailbox. Production verification must use actual email delivery.

## Main app development inbox

To use the main app with its regular development database, set these in the root environment file and restart the API:

```dotenv
NODE_ENV=development
DEV_MAIL_INBOX_ENABLED=true
RESEND_API_KEY=
APP_PUBLIC_BASE_URL=http://localhost:3000
```

Run the web app normally and open http://localhost:3000/dev/mail. Register on the usual signup page, refresh the inbox and open the local verification link. The API binds to `127.0.0.1` when the inbox is enabled. These accounts belong to your configured development database; unlike the standalone lab, they are not automatically discarded. Never point this mode at a production database or expose it with a tunnel/reverse proxy.

The default browser API URL keeps the web server's port, and the local Next.js proxy preserves `/api/v1` without duplicating the version segment. If you override `NEXT_PUBLIC_API_URL`, it must point to your local API when using this mode.

The inbox is opt-in, available only in development with the recorder transport, restricted to loopback peers and local/expected browser origins, marked `no-store`, and excluded from Swagger. Production configuration rejects the flag and the web page returns 404. Captured emails are bounded to the latest 100 messages and rendered as escaped plain text, not raw HTML.

## What the signup filter can and cannot prove

- Server-side syntax and length checks reject malformed input, IP literals and local-only hostnames.
- Domain normalization supports internationalized domains; no Gmail-only or hardcoded TLD allowlist is used.
- DNS checks reject nonexistent domains and explicit null MX records. A/AAAA fallback is allowed for domains without MX, as required by SMTP's implicit-MX behavior.
- MX existence alone does not establish that an individual mailbox exists. Catch-all mail servers and anti-enumeration protections make pre-signup mailbox probing unreliable.
- New registrations remain unverified. The existing HTTP and realtime guards deny workspace access until the one-time email token is confirmed.
- In production, a fabricated local part on a real domain can still create a pending, unusable account. Completing real email verification is the ownership check; the app does not claim DNS makes an address verified.

References: [Node DNS](https://nodejs.org/api/dns.html), [null MX and address fallback](https://www.rfc-editor.org/rfc/rfc7505.html).

## Verification

```powershell
corepack pnpm --filter api test:verification-prototype
corepack pnpm --filter api test -- --runInBand
```

The prototype smoke test runs the real HTTP signup → local inbox → verification → protected access flow against disposable data, including invalid-domain rejection and used-token rejection. It stubs DNS only in the explicit `--smoke` run so the test is deterministic; the normal lab uses real DNS.
