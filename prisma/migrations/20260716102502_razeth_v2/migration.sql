/*
  Warnings:

  - You are about to drop the `cashiers` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[official_id]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nationalId]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `entry_date` to the `profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `official_id` to the `profiles` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "employment_status_enum" AS ENUM ('ACTIVE', 'PROBATION', 'HOLD', 'SECONDMENT', 'STUDY_LEAVE', 'RETIRED', 'RESIGNED', 'TERMINATED', 'TRANSFERRED_OUT', 'DECEASED');

-- CreateEnum
CREATE TYPE "employment_type_enum" AS ENUM ('PERMANENT', 'TRANSFERRED', 'CONTRACT', 'TEMPORARY', 'INTERN');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('INITIAL_APPOINTMENT', 'INTERNAL_TRANSFER', 'INTER_MINISTERIAL', 'PROMOTION', 'DEMOTION', 'TEMPORARY_ASSIGNMENT', 'ACTING_ASSIGNMENT', 'SECONDMENT', 'RETURN_FROM_SECONDMENT', 'REINSTATEMENT', 'RETIREMENT', 'RESIGNATION');

-- CreateEnum
CREATE TYPE "OrganizationChangeType" AS ENUM ('CREATED', 'RENAMED', 'MOVED_PARENT', 'MOVED_MINISTRY', 'MERGED', 'SPLIT', 'DISSOLVED', 'REACTIVATED');

-- DropForeignKey
ALTER TABLE "cashiers" DROP CONSTRAINT "cashiers_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_cashier_id_fkey";

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "actual_retire_date" DATE,
ADD COLUMN     "currentEmploymentId" INTEGER,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "entry_date" DATE NOT NULL,
ADD COLUMN     "expected_retire_date" DATE,
ADD COLUMN     "nationalId" VARCHAR(10),
ADD COLUMN     "nationality" VARCHAR(100),
ADD COLUMN     "official_id" VARCHAR(10) NOT NULL,
ADD COLUMN     "retirement_age" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "status" "employment_status_enum" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "isLinked" BOOLEAN DEFAULT false;

-- DropTable
DROP TABLE "cashiers";

-- CreateTable
CREATE TABLE "ministries" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ministries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ministry_versions" (
    "id" SERIAL NOT NULL,
    "ministryId" INTEGER NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "nameKh" VARCHAR(255) NOT NULL,
    "nameEn" VARCHAR(255) NOT NULL,
    "shortName" VARCHAR(100),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,

    CONSTRAINT "ministry_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_versions" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "ministry_version_id" INTEGER NOT NULL,
    "parent_version_id" INTEGER,
    "code" VARCHAR(20) NOT NULL,
    "name_kh" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255) NOT NULL,
    "short_name" VARCHAR(100),
    "hierarchy_level" INTEGER,
    "display_order" INTEGER,
    "effective_from" TIMESTAMP(6) NOT NULL,
    "effective_to" TIMESTAMP(6),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_transitions" (
    "id" SERIAL NOT NULL,
    "fromDepartmentVersionId" INTEGER NOT NULL,
    "toDepartmentVersionId" INTEGER NOT NULL,
    "type" "OrganizationChangeType" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "note" TEXT,

    CONSTRAINT "department_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_histories" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "ministryVersionId" INTEGER NOT NULL,
    "departmentVersionId" INTEGER NOT NULL,
    "assignmentType" "AssignmentType" NOT NULL,
    "status" "employment_status_enum" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "positionTitle" VARCHAR(150),
    "rank" VARCHAR(100),
    "salaryGrade" VARCHAR(50),
    "salaryStep" VARCHAR(50),
    "decreeNumber" VARCHAR(100),
    "decreeDate" DATE,
    "note" TEXT,

    CONSTRAINT "employment_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DepartmentToMinistry" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DepartmentToMinistry_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ministries_code_key" ON "ministries"("code");

-- CreateIndex
CREATE INDEX "ministry_versions_ministryId_effectiveTo_idx" ON "ministry_versions"("ministryId", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "department_versions_department_id_effective_to_idx" ON "department_versions"("department_id", "effective_to");

-- CreateIndex
CREATE INDEX "department_transitions_fromDepartmentVersionId_idx" ON "department_transitions"("fromDepartmentVersionId");

-- CreateIndex
CREATE INDEX "department_transitions_toDepartmentVersionId_idx" ON "department_transitions"("toDepartmentVersionId");

-- CreateIndex
CREATE INDEX "employment_histories_profileId_endDate_idx" ON "employment_histories"("profileId", "endDate");

-- CreateIndex
CREATE INDEX "employment_histories_departmentVersionId_idx" ON "employment_histories"("departmentVersionId");

-- CreateIndex
CREATE INDEX "employment_histories_ministryVersionId_idx" ON "employment_histories"("ministryVersionId");

-- CreateIndex
CREATE INDEX "_DepartmentToMinistry_B_index" ON "_DepartmentToMinistry"("B");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_official_id_key" ON "profiles"("official_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_nationalId_key" ON "profiles"("nationalId");

-- CreateIndex
CREATE INDEX "profiles_status_idx" ON "profiles"("status");

-- CreateIndex
CREATE INDEX "profiles_entry_date_idx" ON "profiles"("entry_date");

-- CreateIndex
CREATE INDEX "profiles_dob_idx" ON "profiles"("dob");

-- CreateIndex
CREATE INDEX "profiles_expected_retire_date_idx" ON "profiles"("expected_retire_date");

-- CreateIndex
CREATE INDEX "profiles_actual_retire_date_idx" ON "profiles"("actual_retire_date");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_currentEmploymentId_fkey" FOREIGN KEY ("currentEmploymentId") REFERENCES "employment_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministry_versions" ADD CONSTRAINT "ministry_versions_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "ministries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_versions" ADD CONSTRAINT "department_versions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_versions" ADD CONSTRAINT "department_versions_ministry_version_id_fkey" FOREIGN KEY ("ministry_version_id") REFERENCES "ministry_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_versions" ADD CONSTRAINT "department_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "department_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_transitions" ADD CONSTRAINT "department_transitions_fromDepartmentVersionId_fkey" FOREIGN KEY ("fromDepartmentVersionId") REFERENCES "department_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_transitions" ADD CONSTRAINT "department_transitions_toDepartmentVersionId_fkey" FOREIGN KEY ("toDepartmentVersionId") REFERENCES "department_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_histories" ADD CONSTRAINT "employment_histories_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_histories" ADD CONSTRAINT "employment_histories_ministryVersionId_fkey" FOREIGN KEY ("ministryVersionId") REFERENCES "ministry_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_histories" ADD CONSTRAINT "employment_histories_departmentVersionId_fkey" FOREIGN KEY ("departmentVersionId") REFERENCES "department_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToMinistry" ADD CONSTRAINT "_DepartmentToMinistry_A_fkey" FOREIGN KEY ("A") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToMinistry" ADD CONSTRAINT "_DepartmentToMinistry_B_fkey" FOREIGN KEY ("B") REFERENCES "ministries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
