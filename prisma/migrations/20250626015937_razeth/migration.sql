-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "avatar" SET DATA TYPE VARCHAR(2500);
