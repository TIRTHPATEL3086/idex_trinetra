-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "classification" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "cipherPath" TEXT,
    "iv" BYTEA,
    "authTag" BYTEA,
    "originalSha" BYTEA NOT NULL,
    "assetRef" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userRef" BYTEA NOT NULL,
    "dept" TEXT,
    "email" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecryptionEvent" (
    "id" SERIAL NOT NULL,
    "receiptId" BYTEA NOT NULL,
    "shortId" BIGINT NOT NULL,
    "assetId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceRef" BYTEA,
    "deviceLabel" TEXT,
    "contentSha" BYTEA NOT NULL,
    "md5Digest" BYTEA NOT NULL,
    "pHash" BIGINT NOT NULL,
    "dHash" BIGINT,
    "aHash" BIGINT,
    "payloadBits" TEXT NOT NULL,
    "markedPath" TEXT,
    "txHash" BYTEA,
    "blockNumber" BIGINT,
    "chainMode" TEXT NOT NULL DEFAULT 'local',
    "deltaUsed" INTEGER NOT NULL,
    "psnrDb" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecryptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investigation" (
    "id" SERIAL NOT NULL,
    "uploadedSha" BYTEA NOT NULL,
    "candidates" INTEGER NOT NULL DEFAULT 0,
    "topReceiptId" BYTEA,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verdict" TEXT NOT NULL,
    "reasons" TEXT[],
    "elapsedMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetRef_key" ON "Asset"("assetRef");

-- CreateIndex
CREATE UNIQUE INDEX "User_userRef_key" ON "User"("userRef");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DecryptionEvent_receiptId_key" ON "DecryptionEvent"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "DecryptionEvent_shortId_key" ON "DecryptionEvent"("shortId");

-- CreateIndex
CREATE INDEX "DecryptionEvent_pHash_idx" ON "DecryptionEvent"("pHash");

-- CreateIndex
CREATE INDEX "DecryptionEvent_dHash_idx" ON "DecryptionEvent"("dHash");

-- CreateIndex
CREATE INDEX "DecryptionEvent_assetId_idx" ON "DecryptionEvent"("assetId");

-- CreateIndex
CREATE INDEX "DecryptionEvent_userId_idx" ON "DecryptionEvent"("userId");

-- CreateIndex
CREATE INDEX "DecryptionEvent_createdAt_idx" ON "DecryptionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Investigation_createdAt_idx" ON "Investigation"("createdAt");

-- AddForeignKey
ALTER TABLE "DecryptionEvent" ADD CONSTRAINT "DecryptionEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecryptionEvent" ADD CONSTRAINT "DecryptionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
