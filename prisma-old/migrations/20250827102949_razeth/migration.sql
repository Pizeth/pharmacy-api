/*
  Warnings:

  - The values [GOOGLE,MICROSOFT,APPLE,FACEBOOK,TWITTER,GITHUB] on the enum `AuthMethod` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `enabled_flag` on the `Cocktail` table. All the data in the column will be lost.
  - You are about to drop the column `enabledFlag` on the `Customer` table. All the data in the column will be lost.
  - The `user_agent` column on the `LoginAttempt` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `user_agent` column on the `audit_trails` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `enabled_flag` on the `cashiers` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `cocktail_details` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `manufacturers` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `order_lines` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `payment_methods` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `product_specific_unit_hierarchies` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `product_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `product_types` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `product_unit` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `profiles` table. All the data in the column will be lost.
  - The `hold_flag` column on the `profiles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `enabled_flag` on the `promotion_details` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `promotions` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `roles` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `stocks` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `store_branches` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `stores` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `sub_categories` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_flag` on the `warehouses` table. All the data in the column will be lost.
  - Added the required column `isEnabled` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Changed the column `auth_method` on the `users` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AuthMethod_new" AS ENUM ('PASSWORD', 'OIDC', 'TOKEN', 'BIO_METRIC', 'MFA', 'CBA', 'QR');
ALTER TABLE "public"."users" ALTER COLUMN "auth_method" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "auth_method" TYPE "public"."AuthMethod_new"[] USING ("auth_method"::text::"public"."AuthMethod_new"[]);
ALTER TYPE "public"."AuthMethod" RENAME TO "AuthMethod_old";
ALTER TYPE "public"."AuthMethod_new" RENAME TO "AuthMethod";
DROP TYPE "public"."AuthMethod_old";
ALTER TABLE "public"."users" ALTER COLUMN "auth_method" SET DEFAULT ARRAY['PASSWORD']::"public"."AuthMethod"[];
COMMIT;

-- AlterTable
ALTER TABLE "public"."Cocktail" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."Customer" DROP COLUMN "enabledFlag",
ADD COLUMN     "isEnabled" VARCHAR(1) NOT NULL;

-- AlterTable
ALTER TABLE "public"."LoginAttempt" ADD COLUMN     "locale" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "referer" TEXT,
DROP COLUMN "user_agent",
ADD COLUMN     "user_agent" JSONB;

-- AlterTable
ALTER TABLE "public"."audit_trails" DROP COLUMN "user_agent",
ADD COLUMN     "user_agent" JSONB;

-- AlterTable
ALTER TABLE "public"."cashiers" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."categories" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."cocktail_details" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."invoices" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."manufacturers" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."order_lines" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."orders" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."payment_methods" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."payments" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."product_specific_unit_hierarchies" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."product_transactions" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."product_types" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."product_unit" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."products" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."profiles" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "married" SET DEFAULT false,
DROP COLUMN "hold_flag",
ADD COLUMN     "hold_flag" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."promotion_details" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."promotions" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."roles" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."stocks" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."store_branches" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."stores" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."sub_categories" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."suppliers" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_activated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "auth_method" SET DEFAULT ARRAY['PASSWORD']::"public"."AuthMethod"[],
ALTER COLUMN "auth_method" SET DATA TYPE "public"."AuthMethod"[],
ALTER COLUMN "created_by" DROP NOT NULL,
ALTER COLUMN "last_updated_by" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."warehouses" DROP COLUMN "enabled_flag",
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."identity_providers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "authorization_url" TEXT NOT NULL,
    "token_url" TEXT NOT NULL,
    "callback_url" TEXT NOT NULL,
    "user_info_url" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "claims" JSONB,
    "login_hint" TEXT,
    "max_age" INTEGER,
    "nonce" TEXT,
    "response_mode" TEXT,
    "prompt" TEXT,
    "scope" TEXT,
    "uni_locale" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_by" INTEGER,
    "last_updated_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "object_version_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_identities" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_providers_name_key" ON "public"."identity_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_id_provider_user_id_key" ON "public"."user_identities"("provider_id", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_id_user_id_key" ON "public"."user_identities"("provider_id", "user_id");

-- AddForeignKey
ALTER TABLE "public"."user_identities" ADD CONSTRAINT "user_identities_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."identity_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
