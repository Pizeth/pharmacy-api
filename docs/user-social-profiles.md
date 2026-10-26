# User social profiles

Users expose a `socialProfiles` array instead of `telegram`. Each profile has
`id`, `userId`, `providerId`, `handle`, nullable `url`, timestamps, and a nested
`provider` object. User detail, the default user list, and
`GET /v1/users/contact/super-admin` include this array.

Providers live in `social_providers` with `id`, unique lowercase `key`, display
`name`, nullable `websiteUrl` and `icon`, `isEnabled`, and timestamps. Icons are
client-defined identifiers. Administrators can customize fields or add platforms
without schema changes.

## Endpoints

All routes require authentication. Mutations and profile listing additionally
require Better Auth's `user:update` permission (admin and sys-admin).

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/v1/social-providers` | Provider catalog, including disabled providers |
| POST | `/v1/social-providers` | Add provider |
| PATCH | `/v1/social-providers/:id` | Customize or disable provider |
| DELETE | `/v1/social-providers/:id` | Delete unused provider |
| GET | `/v1/users/:userId/social-profiles` | List profiles ordered by ID |
| POST | `/v1/users/:userId/social-profiles` | Create profile |
| PATCH | `/v1/users/:userId/social-profiles/:id` | Edit supplied fields |
| DELETE | `/v1/users/:userId/social-profiles/:id` | Delete profile |

Fetch the catalog for the provider ID; do not hardcode IDs. Example POST:

```json
{ "providerId": 2, "handle": "@alice", "url": "https://t.me/alice" }
```

PATCH accepts any nonempty subset; `url: null` clears a profile URL. URLs must
use HTTP or HTTPS. Duplicate user/provider/handle combinations return HTTP 409.
Multiple handles on the same platform are supported. New profiles and changes
to `providerId` require an enabled provider. Disabling a provider keeps existing
profiles visible and editable. Deleting an in-use provider returns HTTP 409;
deleting a user cascades to their profiles. These contact profiles are separate
from Better Auth login accounts.

## Seeds and migrations

`npm run db:seed` creates Facebook, Telegram, TikTok, YouTube, and Instagram
before seeding the administrator's Telegram and Facebook profiles. Repeated
seeds preserve existing provider customizations and do not duplicate the same
user/provider/handle. Handles default to the seeded administrator username;
override with `SEED_ADMIN_TELEGRAM_HANDLE` and `SEED_ADMIN_FACEBOOK_HANDLE`.
Optional `SEED_ADMIN_TELEGRAM_URL` and `SEED_ADMIN_FACEBOOK_URL` override generated
URLs. Defaults are seed data, not verified account ownership.

`npm run db:seed:social-providers` seeds only missing catalog entries.

For an existing database, run `npx prisma migrate deploy` before starting the
updated API. Migrations preserve Telegram values and convert string providers
to foreign keys. New tables use RLS without Data API policies; the Nest API
accesses them through its privileged Prisma connection.

For a disposable database, use `npm run db:reset -- --force`, regenerate the
client with `npx prisma generate`, then run `npm run db:seed` explicitly.
