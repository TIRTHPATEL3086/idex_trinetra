-- Fragile tamper-evidence layer, and the evidence a court dossier cites.
ALTER TABLE "DecryptionEvent" ADD COLUMN IF NOT EXISTS "fragileLayer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Investigation" ADD COLUMN IF NOT EXISTS "bitsMatched" INTEGER;
ALTER TABLE "Investigation" ADD COLUMN IF NOT EXISTS "tamper" JSONB;
ALTER TABLE "Investigation" ADD COLUMN IF NOT EXISTS "lens" JSONB;
