-- The officer's own security question, asked before a decryption from a
-- device that might not be theirs. Added to the schema without a migration.
ALTER TABLE "User" ADD COLUMN "securityQuestion" TEXT;
ALTER TABLE "User" ADD COLUMN "securityAnswer" TEXT;
