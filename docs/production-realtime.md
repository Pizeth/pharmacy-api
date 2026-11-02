# TranslationKey production realtime (gated)

Contract counterpart: pharmacy-client `docs/datatable-production-realtime-2-0-6.md`.
Base API: `6397beb2e34a75f631228896fa65898f5b013b65`.

`GET /api/v1/live/translations` is a cookie/Bearer-authenticated SSE endpoint.
It requires fresh `read / TranslationKey` CASL authorization before opening,
before every event, and on each 15-second idle heartbeat. Cached cookie sessions
and opening-request abilities are not reused. Account/role disablement, logout,
expiry and revoked permission close the connection. There is no document channel.

Envelope v1 contains `version: 1`, UUID `eventId`, `resource: translations`,
`type: created|updated|deleted|invalidate`, optional string `recordId`, and ISO
`occurredAt`. Only identities cross the wire. Initial/reconnected clients receive
`invalidate` with `reason: resync`. No durable replay/order guarantee is offered.

Migration `20261102000100_translation_realtime` uses PostgreSQL transactional
NOTIFY triggers for keys, translation values and categories. Rollback emits
nothing. All API replicas LISTEN through their own dedicated session connection;
the in-process Subject only fans out already-shared database notifications.

## Rollout requirements

Default is off. Keep `REALTIME_ENABLED` unset until normal Prisma migration
deployment and the isolated cross-client acceptance complete. No reset/seed is
required. Supply `REALTIME_DATABASE_URL` using a dedicated direct or session-mode
connection, never transaction pooling. Each replica needs one connection. Startup
refuses listener readiness if the three enabled triggers are absent.

Validate Northflank replica count, reverse-proxy flushing/buffering, cookie CORS,
heartbeat timeouts and restart behavior. These deployment settings are not yet
verified. Database loss closes streams; listener reconnect is bounded to 1–30 s.
Slow consumers or more than 64 queued notifications reconnect rather than buffer.
Clients canonically refetch on every reconnect because NOTIFY has no replay.

The frontend uses `NEXT_PUBLIC_REALTIME_ENABLED=true` only after the compatible
backend is ready. While both gates are off, either PR can be reviewed without
enabling an incompatible feature. No deployment is claimed by these changes.

## Verification

- Fresh install, Prisma generation, typecheck, 42 suites / 272 tests and backend
  production build passed locally.
- `node scripts/realtime-postgres-acceptance.mjs` requires an explicit
  `REALTIME_TEST_DATABASE_URL`. It creates and removes only a unique scratch
  schema/channel; it never reads production `.env` or falls back to DATABASE_URL.
  The runtime image includes this script and its migration SQL so a separate
  Northflank job can run it using the Infisical test secret. API startup never
  invokes it or changes DATABASE_URL. That job verifies database delivery only;
  authenticated browser acceptance still needs a backend test instance pointed
  at a migrated disposable application database.
- The database harness and two authenticated browser sessions remain BLOCKED
  without a disposable integration environment. Mocked authorization/SSE tests
  and rendered frontend tests do not substitute for production acceptance.
- Production migration is not applied; feature gates remain off. No role grants,
  historical document data, auth configuration or document-progress rights change.

Paired draft reviews: [API #6](https://github.com/Pizeth/pharmacy-api/pull/6) and
[client #55](https://github.com/Pizeth/pharmacy-client/pull/55). Initial backend
head `971f31e219662b211b68604d4b86da8b42f12208` passed
[CI](https://github.com/Pizeth/pharmacy-api/actions/runs/41430120123).
The review follow-up adds explicit request-close, response-close and lifetime
coverage. Normal request completion must keep SSE open; response close and
lifetime expiry release subscriptions/timers and end once. Readiness checks
also match each trigger's table and exact notification function.

The reported missing AuthService provider was not reproduced: installed
nestJs-better-auth configures its async module globally by default and exports
AuthService. A real Nest module-graph regression wraps that configured module
without re-exporting it, imports RealtimeModule first (as AppModule does), and
resolves/calls RealtimeAccess through the real library provider. Auth wiring is
unchanged. This is a DI proof, not a live session/database acceptance claim.

## Post-merge Qodo reliability follow-up

Two later findings on PR #6 are addressed on a separate feature branch. SSE
setup rechecks bus readiness after opening authorization, initializes cleanup
ownership before subscribing, and handles synchronous bus completion safely.
The database harness waits for every bounded connection attempt, never queues
SQL on a never-connected writer, always attempts every client shutdown, and
preserves the primary failure if cleanup also fails. PASS is printed only after
successful cleanup. Runtime packaging includes its cleanup helper.

Follow-up validation: 44 suites / 284 tests, typecheck, changed-file lint and
production build pass. Local Infisical injection works after login. The real
database proof failed before schema creation with a hostname-resolution error;
no database delivery PASS is claimed. No test schema was created by that run.
The user paused deployment following a Northflank security notice and later
reported secret sync restored. This follow-up remains draft for review; no
further Northflank deployment was performed during local validation.

The final review also covers uncertain CREATE outcomes: after all clients have
connected, mark schema creation attempted before sending CREATE. Cleanup then
attempts DROP even when CREATE rejects after a lost response. Actual harness
entry-point tests verify both that path and a failed-connect path without real
database access.

Connected-client error events are captured before connection attempts and routed
through the same failure/cleanup flow. Actual entry-point tests inject errors
from each of the three clients after schema creation, and hold one connection
pending while another fails to verify cleanup waits for all attempts to settle.
