# FROZEN INTERFACES — `docs/CONTRACTS.md`

> **Status:** frozen at Hour 2. Nobody changes anything in this file silently.
> A change here means: message the group → all three agree → one commit that
> updates this file **and** every caller in the same PR.
>
> This file is what lets three people build at the same time without waiting.

| | |
|---|---|
| Problem Statement | SIH26237 — Crypto Decryption Provenance |
| Stack | Node.js 20 + React 18 + PostgreSQL 16 (CPU only) |
| Owners | **A** = core engine · **B** = chain/backend/DB · **C** = frontend |

---

## 0. Ownership map — do not edit files you do not own (§8.2)

| Path | Owner |
|---|---|
| `server/core/watermark.js` `phash.js` `crypto.js` `ecc.js` `psnr.js` `confidence.js` | **A** |
| `test/attack-suite.js` | **A** |
| `contracts/` `scripts/` `hardhat.config.cjs` | **B** |
| `server/index.js` `server/routes/` `server/middleware/` `server/lib/` | **B** |
| `server/core/chain.js` `server/core/bktree.js` `server/core/payload.js` | **B** |
| `prisma/` | **B** |
| `client/` (entire folder) `docs/DEMO-SCRIPT.md` | **C** |

Found a bug in someone else's file? **Message them.** Two people editing
`decrypt.js` at Hour 25 is how projects die.

---

## 1. Person A — core module exports (`server/core/`)

Every one of these is a **pure function on Buffers**. No DB, no network, no
Express. A can build and test all of it with local image files alone.

```js
// server/core/watermark.js  -- owner: A
/**
 * @param {Buffer} imageBuffer  original image bytes
 * @param {string} payloadBits  exactly 48 chars of '0'/'1'
 * @param {number} delta        QIM strength, default 12
 * @returns {Promise<{ buffer: Buffer, psnrDb: number, deltaUsed: number }>}
 */
export async function embed(imageBuffer, payloadBits, delta = 12) {}

/**
 * @param {Buffer} imageBuffer  possibly attacked/compressed image
 * @returns {Promise<{ payloadBits: string, bitConfidence: number, eccCorrected: boolean }>}
 *          bitConfidence in [0,1] — fraction of bits recovered with agreement
 */
export async function extract(imageBuffer) {}

// server/core/phash.js  -- owner: A
/** @returns {Promise<{ pHash: bigint, dHash: bigint, aHash: bigint }>} */
export async function hashes(imageBuffer) {}
export function hamming(a /*bigint*/, b /*bigint*/) /* -> number 0..64 */ {}

// server/core/crypto.js  -- owner: A
export function encrypt(buffer, key) /* -> { ciphertext, iv, authTag } */ {}
export function decrypt(ciphertext, key, iv, authTag) /* -> Buffer */ {}
export function sha256(buffer) /* -> Buffer(32) */ {}
export function md5(buffer)    /* -> Buffer(16) */ {}
export function deriveKey(passphrase, salt) /* -> Buffer(32), scrypt */ {}

// server/core/confidence.js  -- owner: A
/**
 * @param {{ bitConfidence:number, pHashDist:number, dHashDist:number,
 *           aHashDist:number, chainVerified:boolean }} sig
 * @returns {{ score:number, verdict:'ATTRIBUTED'|'PROBABLE'|'INCONCLUSIVE',
 *             reasons:string[] }}
 */
export function score(sig) {}

// server/core/psnr.js  -- owner: A
/** @returns {Promise<number>} PSNR in dB between two image buffers */
export async function psnr(originalBuffer, markedBuffer) {}

// server/core/ecc.js  -- owner: A
export function rsEncode(bits /* string */) /* -> string */ {}
export function rsDecode(bits /* string */) /* -> { bits:string, corrected:boolean } */ {}
export function crc8(bits /* string */) /* -> string, 8 chars */ {}
```

### Confidence formula (A implements exactly this, then tunes)

```js
score = 0.45 * bitAgreement          // fraction of 48 bits recovered cleanly
      + 0.25 * (1 - pHashDist/64)
      + 0.15 * (1 - dHashDist/64)
      + 0.10 * (1 - aHashDist/64)
      + 0.05 * (chainVerified ? 1 : 0);

score >= 0.85 -> ATTRIBUTED     // name the person
score >= 0.60 -> PROBABLE       // "investigate further"
else          -> INCONCLUSIVE   // say "pata nahi" out loud
```

`reasons[]` is always populated with plain sentences. **The jury reads those,
not the number.**

---

## 2. The 48-bit payload layout (A and B must both know this)

```
 bit  0 ... 35   ->  first 36 bits of receiptId  (2^36 receipts = plenty)
 bit 36 ... 43   ->  8-bit CRC over bits 0-35    (catches bad extractions)
 bit 44 ... 47   ->  4-bit version / delta tag   (future-proofing)
 ---------------------------------------------------------------
 48 bits --RS encode--> ~96 bits --5x repeat--> ~480 DWT coefficients
```

The `receiptId -> 36-bit shortId` mapping lives in the `DecryptionEvent`
table, so **B can always look up the full receipt from what A extracts.**

Helpers live in `server/core/payload.js` (owner **B**) so both sides agree:

```js
export function buildPayload(receiptIdHex, versionTag = 1) /* -> 48-char bit string */ {}
export function parsePayload(bits) /* -> { shortId: bigint, crcOk: boolean, version: number } */ {}
```

---

## 3. Person B — API contract (consumed by C)

Base URL: `http://localhost:4000`. Every route is under `/api`.

### `GET /api/health`
```jsonc
{ "ok": true, "mockMode": true, "chainMode": "local", "db": "up", "uptimeSec": 42 }
```

### `POST /api/assets` — multipart: `file`, `title`, `classification`
```jsonc
// -> 201
{ "assetId": 12, "title": "Ops Order 44", "sha256": "ab34...", "sizeBytes": 402193 }
```

### `GET /api/assets`
```jsonc
// -> 200
{ "assets": [ { "assetId":12, "title":"...", "classification":"CONFIDENTIAL",
                "createdAt":"2026-03-12T14:22:00Z", "decryptCount": 7 } ] }
```

### `POST /api/decrypt` — `{ assetId, userId, deviceLabel }`
```jsonc
// -> 200
{
  "receiptId":  "0x7f2c...",
  "txHash":     "0x9ab1...",
  "blockNumber": 5829301,
  "etherscanUrl":"https://sepolia.etherscan.io/tx/0x9ab1...",
  "payloadBits": "1011...",          // 48 chars
  "psnrDb":      42.7,
  "deltaUsed":   12,
  "downloadUrl": "/api/files/marked/7f2c..."
}
```

### `POST /api/trace` — multipart: `file`
```jsonc
// -> 200
{
  "investigationId": 31,
  "verdict":    "ATTRIBUTED",       // ATTRIBUTED | PROBABLE | INCONCLUSIVE
  "confidence": 0.93,
  "match": {                         // null when INCONCLUSIVE
    "userName":   "Officer U-017",
    "department": "Ops Wing",
    "assetTitle": "Ops Order 44",
    "decryptedAt":"2026-03-12T14:22:00Z",
    "deviceLabel":"DESK-114",
    "txHash":     "0x9ab1...",
    "etherscanUrl":"https://sepolia.etherscan.io/tx/0x9ab1..."
  },
  "reasons": [
    "46/48 watermark bits recovered (2 fixed by Reed-Solomon)",
    "dHash distance 3/64",
    "on-chain receipt verified"
  ],
  "candidatesChecked": 1284,
  "elapsedMs": 812
}
```

### `GET /api/audit/:assetId`
```jsonc
// -> 200
{ "assetId":12, "timeline":[
    { "receiptId":"0x7f2c...", "userName":"Officer U-017", "at":"...",
      "device":"DESK-114", "txHash":"0x9ab1...", "psnrDb":42.7 } ] }
```

### `GET /api/metrics`
Serves A's generated `test/metrics.json`. Shape:
```jsonc
{
  "attacks":   [ { "name":"JPEG q90", "survived":true, "bitsRecovered":48, "psnrDb":41.2 } ],
  "psnrCurve": [ { "delta":12, "psnrDb":42.7, "bitsRecovered":48 } ]
}
```

### `GET /api/users`
Convenience route for C's decrypt-screen dropdown.
```jsonc
{ "users": [ { "userId":1, "name":"Officer U-017", "dept":"Ops Wing",
               "userRef":"0x8f3a..." } ] }
```

### `GET /api/files/marked/:receiptId`
Returns the watermarked file as a binary download.

### Error shape — **every** route, no exceptions
```jsonc
{ "error": { "code": "BAD_INPUT", "message": "..." } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `BAD_INPUT` | 400 | Zod validation failed |
| `NOT_FOUND` | 404 | Unknown asset / user / receipt / route |
| `PAYLOAD_TOO_LARGE` | 413 | File over `MAX_UPLOAD_MB` |
| `UNSUPPORTED_MEDIA` | 415 | Not an image we can process |
| `CHAIN_ERROR` | 502 | RPC dead or tx reverted |
| `CORE_NOT_READY` | 503 | A's module still a stub and no fallback allowed |
| `INTERNAL` | 500 | Anything else |

---

## 4. Blockchain vs PostgreSQL — the exact split

**On-chain** (tiny, immutable, privacy-safe — 5 × `bytes32` + a timestamp):

| Field | Type | Why on chain |
|---|---|---|
| `receiptId` | `bytes32` | The unique parchi ID; the watermark points back to this |
| `assetRef` | `bytes32` | `keccak256(assetId \|\| salt)` |
| `userRef` | `bytes32` | `keccak256(userId \|\| salt)` — **hashed, never the name** |
| `contentSha` | `bytes32` | SHA-256 of the exact bytes released |
| `payloadCommit` | `bytes32` | `keccak256(payloadBits \|\| salt)` — proves the mark predates the leak |
| `timestamp` | `uint64` | Block-anchored; cannot be back-dated |

**In PostgreSQL** (big, searchable, private): real names, departments, device
labels, `pHash`/`dHash`/`aHash`, `psnrDb`, `deltaUsed`, encrypted blobs,
investigation history, and `txHash` + `blockNumber` as the pointer back.

> **Viva one-liner:** *"Chain pe sirf wo cheez hai jo badalne se saboot khatam ho
> jata — aur wo bhi hashed. Naam, index, aur speed ke liye PostgreSQL hai.
> Blockchain proof deta hai, Postgres search deta hai."*

---

## 5. `/api/decrypt` orchestration order (B7) — order is not negotiable

```
 1. Zod-validate { assetId, userId, deviceLabel }
 2. Load Asset + User from Postgres
 3. plaintext = crypto.decrypt(asset.cipher, key, iv, authTag)        [A]
 4. contentSha = crypto.sha256(plaintext)                             [A]
 5. receiptId  = keccak256(assetRef || userRef || contentSha || nonce)
 6. payloadBits = buildPayload(receiptId)
 7. payloadCommit = keccak256(payloadBits || SALT)
 8. tx = await chain.logDecryption(...)                            <-- ON CHAIN
 9. { buffer, psnrDb } = await watermark.embed(plaintext, payloadBits, DELTA)  [A]
10. { pHash, dHash, aHash } = await phash.hashes(buffer)              [A]
11. INSERT DecryptionEvent { ..., txHash, blockNumber }            <-- POSTGRES
12. bktree.insert(dHash, eventId)
13. return the JSON from §3
```

> **The chain write happens BEFORE the watermark is handed over.** If the chain
> write fails, no marked file ever leaves the system — so there can never be a
> marked file without a receipt.

## 6. `/api/trace` flow (B8)

```
 1. Multer -> buffer
 2. hashes(buffer)                                                    [A]
 3. bktree.search(dHash) U search(pHash) U search(aHash) -> candidates
 4. watermark.extract(buffer) -> { payloadBits, bitConfidence }       [A]
 5. shortId = payloadBits[0..35] -> look up DecryptionEvent (O(1) index)
 6. chain.getReceipt(receiptId) -> chainVerified
 7. confidence.score({...})                                           [A]
 8. INSERT Investigation
 9. Return match ONLY if verdict !== 'INCONCLUSIVE'; otherwise match = null
```

---

## 7. Integration checkpoints (§8.3)

| Hour | Checkpoint | Pass criteria |
|---|---|---|
| **H2** | Contracts frozen | This file merged; all three agree |
| **H8** | **GO / NO-GO** | A: 46+/48 bits survive JPEG q75 · B: mocks live · C: two screens built |
| **H14** | Chain alive | Real Sepolia txHash exists; C renders an Etherscan link |
| **H20** | **FIRST FULL LOOP** | Upload → Decrypt → download → re-upload → verdict. Ugly is fine. |
| **H28** | Feature freeze | Everything real, no mocks left. New features banned. |
| **H33** | Demo freeze | Video recorded, deck done, two rehearsals complete |
