/*
  Warnings:

  - You are about to drop the column `updated_by` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "updated_by",
ADD COLUMN     "last_updated_by" INTEGER;
