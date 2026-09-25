-- Examiner signatures over each generated dossier's evidence digest.
ALTER TABLE "Investigation" ADD COLUMN IF NOT EXISTS "stamps" JSONB;
