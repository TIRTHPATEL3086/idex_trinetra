-- Server-held escrow of each user's PQC secret keys, wrapped with the master key.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "escrowedPqcKeys" TEXT;
