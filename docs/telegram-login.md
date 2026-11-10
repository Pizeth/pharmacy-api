# Telegram sign-in (OIDC)

Status: initial OIDC integration deployed via PR #15. Live authorization currently stops at Telegram with `redirect_uri required`; verify the exact allowed callback in BotFather before completing sign-in.

## BotFather and Infisical

1. In the official @BotFather mini app, select the application's bot, then **Login Widget**.
2. Register these Allowed URLs for the shared production API:
   - `https://hr.razeth.com`
   - `https://asus-hr.razeth.com`
   - `https://api.razeth.com/api/auth/callback/telegram`
3. Copy the OIDC Client ID and Client Secret from that screen into the backend's Infisical environment as `TELEGRAM_CLIENT_ID` and `TELEGRAM_CLIENT_SECRET`. These are OIDC credentials, not the bot API token or a Telegram application API hash. Never put the secret in frontend/public variables.
4. Keep `BETTER_AUTH_URL=https://api.razeth.com` for that deployment. Restart/redeploy the API after secrets sync. Discovery is fixed to Telegram's official endpoint; `TELEGRAM_DISCOVERY_URL` is no longer required.

For a separate local backend, register its exact callback (`http://localhost:3000/api/auth/callback/telegram` if that is its actual base URL) if BotFather accepts localhost. A frontend on localhost using the production backend still uses the production callback; its origin must also be allowed by the backend's existing trusted-origin policy.

## Identity and email

Only `openid` and `profile` are requested. Better Auth validates signature, issuer, audience and request nonce before our profile mapper runs; PKCE remains enabled. The token endpoint uses HTTP Basic client authentication, as required by the Telegram integration guide. Failed/incomplete discovery must not fall back to unverified decoding.

Telegram does not supply email. New Telegram identities receive a stable, non-deliverable `SUBJECT@telegram.placeholder.invalid` address with `emailVerified: false`. The immutable token subject identifies the account; Telegram usernames are not trusted as email, local usernames or account-linking keys. Users need to add and verify a real email before relying on email recovery. Existing email accounts are not automatically linked by matching Telegram display name or username. Existing explicit account-linking restrictions remain unchanged.

## Acceptance

- With either credential missing, `/api/auth-info/providers` omits Telegram.
- With both present, the existing frontend registry renders its Telegram button and uses the existing `signIn.social` route; no new frontend client plugin is needed for the installed Better Auth version.
- Verify the authorization redirect uses the official Telegram host, supported scopes, state, nonce and S256 PKCE, and its redirect URI exactly matches BotFather.
- Sign in with a disposable Telegram account and confirm its name/photo, unverified placeholder email, and non-admin permissions. Sign out and sign in again: the same account must be reused.
- Exercise deny/cancel and tampered/expired tokens; no session should be created. Do not use an existing administrator account for the first acceptance run.

References: https://core.telegram.org/bots/telegram-login and https://better-auth.com/docs/plugins/generic-oauth
