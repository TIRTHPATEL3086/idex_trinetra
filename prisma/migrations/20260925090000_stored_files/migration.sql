-- Durable copies of ciphertexts and released files, for hosts whose disk
-- does not survive a restart.
CREATE TABLE "StoredFile" (
    "key" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("key")
);
