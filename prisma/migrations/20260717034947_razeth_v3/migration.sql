/*
  Warnings:

  - You are about to drop the column `accessToken` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `accessTokenExpiresAt` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `idToken` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `providerId` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `refreshTokenExpiresAt` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `account` table. All the data in the column will be lost.
  - You are about to drop the column `configId` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `lastRefillAt` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `lastRequest` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `rateLimitEnabled` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `rateLimitMax` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `rateLimitTimeWindow` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `referenceId` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `refillAmount` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `refillInterval` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `requestCount` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `apikey` table. All the data in the column will be lost.
  - You are about to drop the column `effectiveDate` on the `department_transitions` table. All the data in the column will be lost.
  - You are about to drop the column `fromDepartmentVersionId` on the `department_transitions` table. All the data in the column will be lost.
  - You are about to drop the column `toDepartmentVersionId` on the `department_transitions` table. All the data in the column will be lost.
  - You are about to drop the column `assignmentType` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `decreeDate` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `decreeNumber` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `departmentVersionId` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `ministryVersionId` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `positionTitle` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `profileId` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `salaryGrade` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `salaryStep` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `employment_histories` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `jwks` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `jwks` table. All the data in the column will be lost.
  - You are about to drop the column `privateKey` on the `jwks` table. All the data in the column will be lost.
  - You are about to drop the column `publicKey` on the `jwks` table. All the data in the column will be lost.
  - You are about to drop the column `effectiveFrom` on the `ministry_versions` table. All the data in the column will be lost.
  - You are about to drop the column `effectiveTo` on the `ministry_versions` table. All the data in the column will be lost.
  - You are about to drop the column `ministryId` on the `ministry_versions` table. All the data in the column will be lost.
  - You are about to drop the column `nameEn` on the `ministry_versions` table. All the data in the column will be lost.
  - You are about to drop the column `nameKh` on the `ministry_versions` table. All the data in the column will be lost.
  - You are about to drop the column `shortName` on the `ministry_versions` table. All the data in the column will be lost.
  - You are about to drop the column `backedUp` on the `passkey` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `passkey` table. All the data in the column will be lost.
  - You are about to drop the column `credentialID` on the `passkey` table. All the data in the column will be lost.
  - You are about to drop the column `deviceType` on the `passkey` table. All the data in the column will be lost.
  - You are about to drop the column `publicKey` on the `passkey` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `passkey` table. All the data in the column will be lost.
  - You are about to drop the column `currentEmploymentId` on the `profiles` table. All the data in the column will be lost.
  - You are about to drop the column `nationalId` on the `profiles` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `impersonatedBy` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `backupCodes` on the `twoFactor` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `twoFactor` table. All the data in the column will be lost.
  - You are about to drop the column `banExpires` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `banReason` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `displayUsername` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `isActivated` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `isEnabled` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `isLinked` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `isLocked` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginMethod` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `mustChangePassword` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumberVerified` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `twoFactorEnabled` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `verification` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `verification` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `verification` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[provider_id,account_id]` on the table `account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[national_id]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone_number]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `account_id` to the `account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider_id` to the `account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_at` to the `apikey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference_id` to the `apikey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `apikey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `effective_date` to the `department_transitions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `from_department_version_id` to the `department_transitions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `to_department_version_id` to the `department_transitions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `assignment_type` to the `employment_histories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `department_version_id` to the `employment_histories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ministry_version_id` to the `employment_histories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profile_id` to the `employment_histories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `employment_histories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_at` to the `jwks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `private_key` to the `jwks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `public_key` to the `jwks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `effective_from` to the `ministry_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ministry_id` to the `ministry_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_en` to the `ministry_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_kh` to the `ministry_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `backed_up` to the `passkey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `credential_id` to the `passkey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `device_type` to the `passkey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `public_key` to the `passkey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `passkey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_by` to the `session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `backup_codes` to the `twoFactor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `twoFactor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `verification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `verification` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "department_transitions" DROP CONSTRAINT "department_transitions_fromDepartmentVersionId_fkey";

-- DropForeignKey
ALTER TABLE "department_transitions" DROP CONSTRAINT "department_transitions_toDepartmentVersionId_fkey";

-- DropForeignKey
ALTER TABLE "employment_histories" DROP CONSTRAINT "employment_histories_departmentVersionId_fkey";

-- DropForeignKey
ALTER TABLE "employment_histories" DROP CONSTRAINT "employment_histories_ministryVersionId_fkey";

-- DropForeignKey
ALTER TABLE "employment_histories" DROP CONSTRAINT "employment_histories_profileId_fkey";

-- DropForeignKey
ALTER TABLE "ministry_versions" DROP CONSTRAINT "ministry_versions_ministryId_fkey";

-- DropForeignKey
ALTER TABLE "passkey" DROP CONSTRAINT "passkey_userId_fkey";

-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_currentEmploymentId_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- DropForeignKey
ALTER TABLE "twoFactor" DROP CONSTRAINT "twoFactor_userId_fkey";

-- DropIndex
DROP INDEX "account_providerId_accountId_key";

-- DropIndex
DROP INDEX "account_userId_idx";

-- DropIndex
DROP INDEX "apikey_configId_idx";

-- DropIndex
DROP INDEX "apikey_referenceId_idx";

-- DropIndex
DROP INDEX "department_transitions_fromDepartmentVersionId_idx";

-- DropIndex
DROP INDEX "department_transitions_toDepartmentVersionId_idx";

-- DropIndex
DROP INDEX "employment_histories_departmentVersionId_idx";

-- DropIndex
DROP INDEX "employment_histories_ministryVersionId_idx";

-- DropIndex
DROP INDEX "employment_histories_profileId_endDate_idx";

-- DropIndex
DROP INDEX "ministry_versions_ministryId_effectiveTo_idx";

-- DropIndex
DROP INDEX "passkey_credentialID_idx";

-- DropIndex
DROP INDEX "passkey_userId_idx";

-- DropIndex
DROP INDEX "profiles_nationalId_key";

-- DropIndex
DROP INDEX "session_userId_idx";

-- DropIndex
DROP INDEX "twoFactor_userId_idx";

-- DropIndex
DROP INDEX "user_phoneNumber_key";

-- AlterTable
ALTER TABLE "account" DROP COLUMN "accessToken",
DROP COLUMN "accessTokenExpiresAt",
DROP COLUMN "accountId",
DROP COLUMN "createdAt",
DROP COLUMN "idToken",
DROP COLUMN "providerId",
DROP COLUMN "refreshToken",
DROP COLUMN "refreshTokenExpiresAt",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "access_token_expires_at" TIMESTAMP(3),
ADD COLUMN     "account_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id_token" TEXT,
ADD COLUMN     "provider_id" TEXT NOT NULL,
ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "refresh_token_expires_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "apikey" DROP COLUMN "configId",
DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "lastRefillAt",
DROP COLUMN "lastRequest",
DROP COLUMN "rateLimitEnabled",
DROP COLUMN "rateLimitMax",
DROP COLUMN "rateLimitTimeWindow",
DROP COLUMN "referenceId",
DROP COLUMN "refillAmount",
DROP COLUMN "refillInterval",
DROP COLUMN "requestCount",
DROP COLUMN "updatedAt",
ADD COLUMN     "config_id" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "last_refill_at" TIMESTAMP(3),
ADD COLUMN     "last_request" TIMESTAMP(3),
ADD COLUMN     "rate_limit_enabled" BOOLEAN DEFAULT true,
ADD COLUMN     "rate_limit_max" INTEGER DEFAULT 10,
ADD COLUMN     "rate_limit_time_window" INTEGER DEFAULT 86400000,
ADD COLUMN     "reference_id" TEXT NOT NULL,
ADD COLUMN     "refill_amount" INTEGER,
ADD COLUMN     "refill_interval" INTEGER,
ADD COLUMN     "request_count" INTEGER DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "department_transitions" DROP COLUMN "effectiveDate",
DROP COLUMN "fromDepartmentVersionId",
DROP COLUMN "toDepartmentVersionId",
ADD COLUMN     "effective_date" DATE NOT NULL,
ADD COLUMN     "from_department_version_id" INTEGER NOT NULL,
ADD COLUMN     "to_department_version_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "employment_histories" DROP COLUMN "assignmentType",
DROP COLUMN "decreeDate",
DROP COLUMN "decreeNumber",
DROP COLUMN "departmentVersionId",
DROP COLUMN "endDate",
DROP COLUMN "ministryVersionId",
DROP COLUMN "positionTitle",
DROP COLUMN "profileId",
DROP COLUMN "salaryGrade",
DROP COLUMN "salaryStep",
DROP COLUMN "startDate",
ADD COLUMN     "assignment_type" "AssignmentType" NOT NULL,
ADD COLUMN     "decree_date" DATE,
ADD COLUMN     "decree_number" VARCHAR(100),
ADD COLUMN     "department_version_id" INTEGER NOT NULL,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "ministry_version_id" INTEGER NOT NULL,
ADD COLUMN     "position_title" VARCHAR(150),
ADD COLUMN     "profile_id" INTEGER NOT NULL,
ADD COLUMN     "salary_grade" VARCHAR(50),
ADD COLUMN     "salary_step" VARCHAR(50),
ADD COLUMN     "start_date" DATE NOT NULL;

-- AlterTable
ALTER TABLE "jwks" DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "privateKey",
DROP COLUMN "publicKey",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "private_key" TEXT NOT NULL,
ADD COLUMN     "public_key" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ministry_versions" DROP COLUMN "effectiveFrom",
DROP COLUMN "effectiveTo",
DROP COLUMN "ministryId",
DROP COLUMN "nameEn",
DROP COLUMN "nameKh",
DROP COLUMN "shortName",
ADD COLUMN     "effective_from" DATE NOT NULL,
ADD COLUMN     "effective_to" DATE,
ADD COLUMN     "ministry_id" INTEGER NOT NULL,
ADD COLUMN     "name_en" VARCHAR(255) NOT NULL,
ADD COLUMN     "name_kh" VARCHAR(255) NOT NULL,
ADD COLUMN     "short_name" VARCHAR(100);

-- AlterTable
ALTER TABLE "passkey" DROP COLUMN "backedUp",
DROP COLUMN "createdAt",
DROP COLUMN "credentialID",
DROP COLUMN "deviceType",
DROP COLUMN "publicKey",
DROP COLUMN "userId",
ADD COLUMN     "backed_up" BOOLEAN NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3),
ADD COLUMN     "credential_id" TEXT NOT NULL,
ADD COLUMN     "device_type" TEXT NOT NULL,
ADD COLUMN     "public_key" TEXT NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "currentEmploymentId",
DROP COLUMN "nationalId",
ADD COLUMN     "current_employment_id" INTEGER,
ADD COLUMN     "national_id" VARCHAR(10);

-- AlterTable
ALTER TABLE "session" DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "impersonatedBy",
DROP COLUMN "ipAddress",
DROP COLUMN "updatedAt",
DROP COLUMN "userAgent",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "impersonated_by" TEXT,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "updated_by" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_agent" TEXT,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "twoFactor" DROP COLUMN "backupCodes",
DROP COLUMN "userId",
ADD COLUMN     "backup_codes" TEXT NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "banExpires",
DROP COLUMN "banReason",
DROP COLUMN "createdAt",
DROP COLUMN "createdBy",
DROP COLUMN "deletedAt",
DROP COLUMN "displayUsername",
DROP COLUMN "emailVerified",
DROP COLUMN "isActivated",
DROP COLUMN "isEnabled",
DROP COLUMN "isLinked",
DROP COLUMN "isLocked",
DROP COLUMN "lastLoginMethod",
DROP COLUMN "mustChangePassword",
DROP COLUMN "phoneNumber",
DROP COLUMN "phoneNumberVerified",
DROP COLUMN "twoFactorEnabled",
DROP COLUMN "updatedAt",
DROP COLUMN "updatedBy",
ADD COLUMN     "ban_expires" TIMESTAMP(3),
ADD COLUMN     "ban_reason" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "deleted_at" TEXT,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_activated" BOOLEAN DEFAULT false,
ADD COLUMN     "is_enabled" BOOLEAN DEFAULT true,
ADD COLUMN     "is_linked" BOOLEAN DEFAULT false,
ADD COLUMN     "is_locked" BOOLEAN DEFAULT false,
ADD COLUMN     "last_login_method" TEXT,
ADD COLUMN     "must_change_password" BOOLEAN DEFAULT false,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "phone_number_verified" BOOLEAN,
ADD COLUMN     "two_factor_enabled" BOOLEAN DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "verification" DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_id_account_id_key" ON "account"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "apikey_config_id_idx" ON "apikey"("config_id");

-- CreateIndex
CREATE INDEX "apikey_reference_id_idx" ON "apikey"("reference_id");

-- CreateIndex
CREATE INDEX "department_transitions_from_department_version_id_idx" ON "department_transitions"("from_department_version_id");

-- CreateIndex
CREATE INDEX "department_transitions_to_department_version_id_idx" ON "department_transitions"("to_department_version_id");

-- CreateIndex
CREATE INDEX "employment_histories_profile_id_end_date_idx" ON "employment_histories"("profile_id", "end_date");

-- CreateIndex
CREATE INDEX "employment_histories_department_version_id_idx" ON "employment_histories"("department_version_id");

-- CreateIndex
CREATE INDEX "employment_histories_ministry_version_id_idx" ON "employment_histories"("ministry_version_id");

-- CreateIndex
CREATE INDEX "ministry_versions_ministry_id_effective_to_idx" ON "ministry_versions"("ministry_id", "effective_to");

-- CreateIndex
CREATE INDEX "passkey_user_id_idx" ON "passkey"("user_id");

-- CreateIndex
CREATE INDEX "passkey_credential_id_idx" ON "passkey"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_national_id_key" ON "profiles"("national_id");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "twoFactor_user_id_idx" ON "twoFactor"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_number_key" ON "user"("phone_number");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_current_employment_id_fkey" FOREIGN KEY ("current_employment_id") REFERENCES "employment_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministry_versions" ADD CONSTRAINT "ministry_versions_ministry_id_fkey" FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_transitions" ADD CONSTRAINT "department_transitions_from_department_version_id_fkey" FOREIGN KEY ("from_department_version_id") REFERENCES "department_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_transitions" ADD CONSTRAINT "department_transitions_to_department_version_id_fkey" FOREIGN KEY ("to_department_version_id") REFERENCES "department_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_histories" ADD CONSTRAINT "employment_histories_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_histories" ADD CONSTRAINT "employment_histories_ministry_version_id_fkey" FOREIGN KEY ("ministry_version_id") REFERENCES "ministry_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_histories" ADD CONSTRAINT "employment_histories_department_version_id_fkey" FOREIGN KEY ("department_version_id") REFERENCES "department_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
