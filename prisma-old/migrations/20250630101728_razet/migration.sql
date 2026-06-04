/*
  Warnings:

  - You are about to alter the column `avatar` on the `users` table. The data in that column could be lost. The data in that column will be cast from `VarChar(2500)` to `VarChar(150)`.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "avatar" SET DATA TYPE VARCHAR(150);
