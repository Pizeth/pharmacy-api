# Translation query timing

Temporarily set `TRANSLATION_QUERY_TIMING=true` in the API environment to log
one timing record for each completed `POST /api/v1/i18n/keys/query` response.
Filter API logs by `TranslationQueryTiming` and send one signed-in request
at a time through the frontend's `/test` page. Unset the flag when finished.

- `totalMs` measures from the API middleware to response completion.
- `beforePolicyMs` includes authentication and other work before the policy
  lookup. It is not an isolated Better Auth measurement.
- `policyMs` measures loading the caller's CASL ability.
- `rowsMs` and `countMs` measure the two concurrent Prisma operations,
  including connection acquisition. Do not add them to get elapsed time.

The logs contain durations and HTTP status only. The browser duration also
includes time outside the Nest process, such as networking and proxy work.
