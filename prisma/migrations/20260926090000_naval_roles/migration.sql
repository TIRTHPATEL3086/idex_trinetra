-- The naval role names added to the Role enum. The original three stay as
-- aliases, so existing accounts keep working.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CRYPTO_CUSTODIAN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TACTICAL_OFFICER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FORENSIC_ANALYST';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'NAVAL_AUDITOR';
