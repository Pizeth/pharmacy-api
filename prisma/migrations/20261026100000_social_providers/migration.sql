CREATE TABLE "social_providers" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "website_url" VARCHAR(2048),
    "icon" VARCHAR(255),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "social_providers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "social_providers_key_key" ON "social_providers"("key");

INSERT INTO "social_providers" ("key", "name", "updated_at")
SELECT DISTINCT "provider", initcap("provider"), CURRENT_TIMESTAMP
FROM "user_social_profiles";

ALTER TABLE "user_social_profiles" ADD COLUMN "provider_id" INTEGER;
UPDATE "user_social_profiles" AS profile SET "provider_id" = provider."id"
FROM "social_providers" AS provider WHERE provider."key" = profile."provider";
ALTER TABLE "user_social_profiles" ALTER COLUMN "provider_id" SET NOT NULL;
DROP INDEX "user_social_profiles_user_id_provider_handle_key";
ALTER TABLE "user_social_profiles" DROP COLUMN "provider";
CREATE UNIQUE INDEX "user_social_profiles_user_id_provider_id_handle_key"
ON "user_social_profiles"("user_id", "provider_id", "handle");
CREATE INDEX "user_social_profiles_provider_id_idx" ON "user_social_profiles"("provider_id");
ALTER TABLE "user_social_profiles" ADD CONSTRAINT "user_social_profiles_provider_id_fkey"
FOREIGN KEY ("provider_id") REFERENCES "social_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- These tables are accessed through the Nest API, not the Supabase Data API.
ALTER TABLE "social_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_social_profiles" ENABLE ROW LEVEL SECURITY;
