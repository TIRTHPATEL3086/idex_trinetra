-- Restore the INVESTIGATOR role. IF NOT EXISTS because some databases kept the
-- value from before the roles were trimmed.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INVESTIGATOR';
