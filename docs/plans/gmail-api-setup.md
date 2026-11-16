# Gmail API delivery on Render free

The API can send verification and password-reset messages through Gmail over
HTTPS (port 443). No custom domain, SMTP connection, or App Password is used.
Only the sender account authorizes Google access; app users do not connect Gmail.
Verification remains required before protected workspace access.

## 1. Configure Google Cloud

Sign in as `workspace.os.verify@gmail.com` at <https://console.cloud.google.com/>.

1. Create a project named **Workspace OS Mail**.
2. Under **APIs & Services > Library**, enable **Gmail API**.
3. Open **Google Auth Platform** (formerly OAuth consent screen). Configure
   Branding, a support email, and developer contact email. Choose an **External**
   audience for a personal Gmail account.
4. Under Data Access, request only
   `https://www.googleapis.com/auth/gmail.send`. Do not request inbox-reading or
   full mailbox access.
5. While Testing, add `workspace.os.verify@gmail.com` as a test user.
6. Create an OAuth client with type **Web application**. Add this exact authorized
   redirect URI: `https://developers.google.com/oauthplayground`.
7. Keep the client ID and client secret private. Do not commit downloaded credentials.

Console names may vary. This is a sender-only authorization, not a replacement
for the application's own account login.

## 2. Authorize the sender once

Use Google's official <https://developers.google.com/oauthplayground/>:

1. Open the settings gear and enable **Use your own OAuth credentials**.
2. Enter your project's client ID and secret. Ensure access type is **Offline**
   and consent is requested. Do not use the Playground's default OAuth client.
3. Enter the scope `https://www.googleapis.com/auth/gmail.send` and authorize.
4. Select **workspace.os.verify@gmail.com** and review the send-only permission.
5. Exchange the authorization code for tokens. Save the **refresh token** privately;
   the short-lived access token is not the deployment credential.

Only authorize a project you control. If Google blocks authorization, inspect its
reason; do not disable account security protections to bypass it.

**Important:** External apps in Testing normally receive Gmail refresh tokens
that expire after **seven days**. Before ongoing deployment, change the audience's
publishing status to **In production**, then authorize again to obtain a new
refresh token. Publishing is not the same as Google verification. Google may
display an unverified-app warning or impose user limits; follow its console
requirements. A sender-only personal-use application may qualify for verification
exceptions; do not assume approval. Never invite all app users to authorize Gmail.

Even production tokens can be revoked, including after a password change for Gmail
scopes. If delivery stops, reauthorize and replace the refresh token.

## 3. Set Render environment variables BEFORE pushing/deploying

On the existing API service, open **Environment** and set:

| Variable | Value |
| --- | --- |
| `MAIL_PROVIDER` | `gmail` |
| `GMAIL_USER` | `workspace.os.verify@gmail.com` |
| `GMAIL_CLIENT_ID` | Your OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Your OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Your sender's refresh token |
| `APP_PUBLIC_BASE_URL` | Your actual `https://...vercel.app` web origin, not the API |
| `DEV_MAIL_INBOX_ENABLED` | `false` (or leave unset) |

Remove a stale `MAIL_FROM`, or set it to
`Workspace OS <workspace.os.verify@gmail.com>`; the email must match `GMAIL_USER`.
`RESEND_API_KEY` is unnecessary when Gmail is selected.

Do not put Google secrets in Vercel public variables, Git, screenshots, logs, or
chat. The Render blueprint selects Gmail for new services; update an existing
service manually instead of expecting a Git push to supply secrets. Empty
`MAIL_PROVIDER` should be **removed**, not entered as a blank value.

Vercel continues to need only its existing `NEXT_PUBLIC_API_URL` for API routing.
No new database migration or frontend credential is needed. Deployment validates
credential presence, not whether Google actually accepts them.

## 4. Verify the deployed app

1. Deploy API and web only after setting the variables.
2. Sign up with an inbox you control; confirm a real message arrives from the sender.
3. Open its link and explicitly verify. Protected workspace access must be denied
   before verification and allowed afterward.
4. Test resend and password reset. A provider message ID means Google accepted the
   message, not that it reached the inbox. Check spam and the sender's Sent folder.
5. If delivery fails, check Gmail API enablement, OAuth permission, sender account,
   token expiry/revocation, and quotas. Do not expose upstream error bodies or tokens.

The transport uses bounded timeouts, caches access tokens, shares concurrent
refresh requests, and does not automatically retry send requests (to avoid
duplicate verification emails after uncertain network outcomes). Gmail account
sending limits and anti-abuse controls still apply; this is for small-scale use,
not a bulk-mail service. Local tests mock Google; live delivery requires your setup.

## Official references

- [Gmail send endpoint](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send)
- [OAuth offline access](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Refresh token expiration rules](https://developers.google.com/identity/protocols/oauth2/)
- [OAuth verification exceptions](https://support.google.com/cloud/answer/13464323)
- [OAuth Playground credential settings](https://developers.google.com/oauthplayground/)
- [Render free SMTP restrictions](https://render.com/docs/free)
