/*
  Warnings:

  - You are about to drop the `Cocktail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Customer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LoginAttempt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MFABackupCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."RefreshToken" DROP CONSTRAINT "RefreshToken_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."cocktail_details" DROP CONSTRAINT "cocktail_details_cocktailId_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_customerId_fkey";

-- DropTable
DROP TABLE "public"."Cocktail";

-- DropTable
DROP TABLE "public"."Customer";

-- DropTable
DROP TABLE "public"."LoginAttempt";

-- DropTable
DROP TABLE "public"."MFABackupCode";

-- DropTable
DROP TABLE "public"."RefreshToken";

-- CreateTable
CREATE TABLE "public"."mfa_backup_codes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."login_attempts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "username" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."LoginStatus" NOT NULL,
    "reason" TEXT,
    "locale" TEXT,
    "referer" TEXT,
    "user_agent" JSONB,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cocktails" (
    "id" SERIAL NOT NULL,
    "cocktail_code" VARCHAR(30),
    "name" VARCHAR(200) NOT NULL,
    "short_name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "image" VARCHAR(255),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_by" INTEGER NOT NULL,
    "last_updated_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "object_version_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cocktails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" SERIAL NOT NULL,
    "customerNumber" VARCHAR(30) NOT NULL,
    "mobileNumber" VARCHAR(30) NOT NULL,
    "gender" VARCHAR(1),
    "identifyType" VARCHAR(1),
    "identifyNumber" VARCHAR(100),
    "description" VARCHAR(255),
    "registeredDate" TIMESTAMP(3),
    "isEnabled" VARCHAR(1) NOT NULL,
    "holdFlag" VARCHAR(1),
    "phoneNumber" VARCHAR(30),
    "address" VARCHAR(200),
    "created_by" INTEGER NOT NULL,
    "created_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_by" INTEGER NOT NULL,
    "last_updated_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "object_version_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mfa_backup_codes_code_key" ON "public"."mfa_backup_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "public"."refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cocktails_cocktail_code_key" ON "public"."cocktails"("cocktail_code");

-- CreateIndex
CREATE UNIQUE INDEX "cocktails_name_key" ON "public"."cocktails"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cocktails_short_name_key" ON "public"."cocktails"("short_name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customerNumber_key" ON "public"."customers"("customerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "customers_mobileNumber_key" ON "public"."customers"("mobileNumber");

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cocktail_details" ADD CONSTRAINT "cocktail_details_cocktailId_fkey" FOREIGN KEY ("cocktailId") REFERENCES "public"."cocktails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
