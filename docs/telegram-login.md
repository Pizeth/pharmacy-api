# Telegram sign-in (OIDC)

Status: Telegram OIDC, Basic token authentication and modern Sentinel headers are deployed. The callback header normalization below is awaiting deployment and final user sign-in acceptance.

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

## Proxy-safe device identification

The production ingress rewrites the generic `X-Request-Id` header. A controlled anonymous-device check confirmed the record exists in KV, but the API's `__infra-rid` cookie contained a different ID. OAuth then could not resolve a verified visitor and correctly blocked new-account creation. Existing Google sign-in does not exercise that creation guard.

Use `@better-auth/infra` 0.4.28 on both ends and `sentinelHeaders: 'modern'` in the browser client, so identity and challenge requests use `X-Sentinel-*`. Backend CORS must allow those request headers and expose namespaced challenge headers. The new server accepts modern and legacy inputs; keep legacy challenge responses during backend-first rollout so existing clients can still solve challenges. The modern client reads either response family.

Deploy the backend support before the frontend. Rebuild/restart development clients after their dependency/configuration update, and hard-refresh the login page; the development hostname currently returns long-lived browser cache headers for stable chunk URLs.

Acceptance: a real KV lookup ID sent as `X-Sentinel-Request-Id` must survive the ingress and appear unchanged in the OAuth relay cookie even when generic `X-Request-Id` differs. Forged visitor headers or missing/unresolvable device records must remain blocked. No placeholder device ID or guard exemption is used.

### Redirect callback trace headers

The modern-header release protected the initial POST, but the ingress also adds a generic `X-Request-Id` to the redirected GET callback. Infra 0.4.28 prefers that header over its saved cookie, so a verified cookie alone is insufficient. The Better Auth dashboard confirmed the initial request passed while `/callback/:id` was blocked with `identification_required`. A local callback regression reproduces this failure by adding the ingress header to an otherwise valid redirect.

`sentinelProxyHeaders()` removes only generic `X-Request-Id` on GET `/callback/:id` and `/oauth2/callback/:id` under Better Auth's configured base path, when no explicit modern identification header is present. Sentinel still resolves the untouched `__infra-rid` cookie through KV. Explicit modern IDs retain precedence, including invalid IDs; absent or forged cookies still fail. POST identification, other routes, OAuth state/nonce/signature verification, IP headers and account-creation policy stay unchanged.
