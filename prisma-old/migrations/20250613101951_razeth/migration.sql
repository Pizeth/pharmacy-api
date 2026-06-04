/*
  Warnings:

  - You are about to drop the `AuditTrail` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOCKED', 'BANNED', 'DISABLED', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'MFA_ENABLED', 'MFA_DISABLED');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('User', 'Role', 'Profile', 'Product', 'Category', 'SubCategory', 'Order', 'OrderLine', 'Invoice', 'Customer', 'Supplier');

-- DropForeignKey
ALTER TABLE "AuditTrail" DROP CONSTRAINT "AuditTrail_user_id_fkey";

-- DropTable
DROP TABLE "AuditTrail";

-- CreateTable
CREATE TABLE "audit_trails" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER,
    "ip_address" TEXT NOT NULL,
    "action" "AuditActionType" NOT NULL,
    "target_type" "AuditTargetType",
    "target_id" TEXT,
    "description" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "user_agent" TEXT,
    "session_id" TEXT,

    CONSTRAINT "audit_trails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_trails_user_id_timestamp_idx" ON "audit_trails"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_trails_target_type_target_id_idx" ON "audit_trails"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_trails_target_type_target_id_timestamp_idx" ON "audit_trails"("target_type", "target_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_trails_action_timestamp_idx" ON "audit_trails"("action", "timestamp");

-- CreateIndex
CREATE INDEX "audit_trails_timestamp_idx" ON "audit_trails"("timestamp");

-- AddForeignKey
ALTER TABLE "audit_trails" ADD CONSTRAINT "audit_trails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
