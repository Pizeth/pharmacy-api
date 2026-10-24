-- Better Auth 1.7.3+ identifies accounts by providerId and accountId and no longer writes issuer.
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;
