# Tracking authorization closeout

Attachments use one canAttachDocument rule for URL links and multipart uploads: unarchived documents are writable by actual tracking administrators, delegated manage/TrackedDocument managers and the currently assigned active-stage handler. Upload preflight checks the rule before R2; attach re-resolves the account and its role inside the version-claim transaction and checks the same rule against the latest document. Claim conflicts and denied linking preserve the original error and trigger uploaded-object cleanup. Existing R2 scan behavior is unchanged.

Document management remains separate from isTrackingAdmin. Progress cancellation, reopening and overriding another handler remain restricted to actual tracking administrators. The response exposes permissions.canAttach independently from canUpdateProgress, including completed/cancelled record differences. Deploy this API before its pharmacy-client companion so attachment controls receive the new capability. No roles schema or historical import changes are required.

## Target migration evidence

Supabase project jkfyjxttbddnwcpyjrpc matches the repository DATABASE_URL project reference. On 31 October 2026, the latest permission migration and catalog entry were initially absent. Only the SQL from 20261029090000_document_management_permission was applied in an advisory-locked transaction, with its Prisma history entry. SHA-256: 383085eb3a7fdbbdef769969ea8fa4feaa57f727ecbcef77fde5bf10d7c49ef1. Verification found permission id 11 (manage/TrackedDocument), a successful migration record, and the identical 15 pre-existing role-grant links. No reset, bulk migration deployment, or seed was used. This adds no grants to existing roles.

## Safe cross-repository HTTP smoke

Run from pharmacy-api with the sibling pharmacy-client checkout on its companion branch:

    node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.seed.json scripts/tracking-authorization-closeout-smoke.ts

Set TRACKING_CLIENT_ROOT if the client checkout is elsewhere. The harness bundles the actual frontend transport and contracts, starts only the tracking Nest controller on an ephemeral loopback port with the production StandardSchemaValidationPipe, and uses the real Prisma database/service. Test identity injection is scoped to this isolated controller instance; it does not alter production auth or create reusable sessions. R2/scanning are mocked; no real file is uploaded or sent to VirusTotal. All temporary users, manager role/grant, document stages, events and attachments roll back, including on failures. Cleanup verifies no run-specific records remain and role-grant count is unchanged. PostgreSQL sequences can advance despite rollback.

The initial smoke passed 15 checks. It covers metadata administrator separation, URL/multipart attachments by a delegated manager, denied progress/cancel/reopen, stale attachment writes, unrelated reader scope, ordinary assigned-handler attachment/progress and disabled-account rejection. It is an integration smoke, not proof that the unmerged changes are deployed or that a live Better Auth session and real R2/scanner succeed.
