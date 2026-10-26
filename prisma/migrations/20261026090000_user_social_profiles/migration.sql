CREATE TABLE "user_social_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "handle" TEXT NOT NULL,
    "url" VARCHAR(2048),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_social_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_social_profiles_user_id_provider_handle_key"
ON "user_social_profiles"("user_id", "provider", "handle");

ALTER TABLE "user_social_profiles" ADD CONSTRAINT "user_social_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_social_profiles" ("user_id", "provider", "handle", "updated_at")
SELECT "id", 'telegram', "telegram", CURRENT_TIMESTAMP
FROM "user" WHERE "telegram" IS NOT NULL;

ALTER TABLE "user" DROP COLUMN "telegram";
