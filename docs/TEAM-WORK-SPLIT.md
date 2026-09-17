# SIH26237 — Crypto Decryption Provenance
## Team Work Distribution Plan (3 Members × 36 Hours)

> **One line pitch:** *"Jab koi secret file kholta hai, hum us copy me Haar-DWT se uska invisible nishan daal dete hain aur record blockchain pe likh dete hain. Baad me file leak ho, to kharab hui file se bhi nishan nikaal ke bata dete hain ki kisne, kab kholi thi — aur kitna pakka hai."*

| | |
|---|---|
| **Problem Statement ID** | SIH26237 |
| **Theme** | Blockchain & Cybersecurity |
| **Mandated Stack** | Node.js + React + PostgreSQL (CPU only) |
| **Team Size (this plan)** | 3 developers |
| **Duration** | 36 hours |
| **Repo** | single monorepo, one language (JavaScript) end-to-end |

---

## 0. Read This First (Everyone, Hour 0)

Before anyone writes a line of code, all three members must agree on these 6 facts. If any one person is confused here, the integration at Hour 20 will fail.

1. **Encryption is not the deliverable.** AES is 20 lines of built-in Node code. The deliverable is *what happens AFTER decryption* — the invisible mark + the immutable register.
2. **Module A (watermark) is the whole project.** If the invisible mark does not survive JPEG compression, nothing else matters. Person A starts at Hour 2 and does not stop.
3. **Never say "this person did it" directly.** Three verdict bands always: `ATTRIBUTED (>=85%)` / `PROBABLE (60-85%)` / `INCONCLUSIVE (<60%)`. Judges reward this; a wrong accusation ends a real person's career.
4. **Names never go on the blockchain.** Only `keccak256(userId || salt)`. Real identity lives in PostgreSQL only. This kills the "privacy kya?" question instantly.
5. **Blockchain = proof, PostgreSQL = search.** Chain stores 5 tiny fields that must be un-editable. Postgres stores everything we need to search fast. Detailed split in §3.
6. **Interfaces are frozen at Hour 2.** The function signatures and API shapes in §4 are a contract. Nobody changes them without telling the other two. This is what lets 3 people work in parallel without blocking each other.

---

## 1. System Architecture (shared mental model)

```
                    +----------------------------------------------+
                    |  RASTA 1 -- DECRYPT (koi file kholta hai)     |
                    +----------------------------------------------+

  Officer clicks                                          Marked file
   "Decrypt"                                              downloads
       |                                                       ^
       v                                                       |
 +-----------+   +--------------+   +--------------+   +----------------+
 |  React    |-->|  Express API |-->|  AES-256-GCM |-->| Haar DWT + QIM |
 | Dashboard |   | /api/decrypt |   |   decrypt    |   |  embed 48 bits |
 +-----------+   +------+-------+   +--------------+   +----------------+
    [Person C]          |  [Person B]      [Person A]        [Person A]
                        |
            +-----------+-----------+
            v                       v
   +-----------------+     +------------------+
   |  Sepolia chain  |     |  PostgreSQL 16   |
   |  logDecryption()|     | DecryptionEvent  |
   |  -> txHash      |     | + pHash/dHash    |
   +-----------------+     +------------------+
        [Person B]               [Person B]


                    +----------------------------------------------+
                    |  RASTA 2 -- TRACE (leak pakadna hai)          |
                    +----------------------------------------------+

  Leaked file
   uploaded
       |
       v
 +-----------+   +-------------+   +--------------+   +--------------+
 |  React    |-->| /api/trace  |-->|  BK-tree on  |-->| DWT extract  |
 |  Upload   |   |             |   | pHash/dHash  |   |  48 bits     |
 +-----------+   +-------------+   +--------------+   +------+-------+
    [Person C]      [Person B]        [Person B]             | [Person A]
                                                             v
                        +--------------------------------------------+
                        | confidence.js -> score + band              |
                        | ATTRIBUTED / PROBABLE / INCONCLUSIVE       |
                        | + Etherscan link to the original receipt   |
                        +--------------------------------------------+
                             [Person A: math]  [Person C: display]
```

---

## 2. Tech Stack (locked — no debates during the hackathon)

| Layer | Choice | Owner | Why this and not the alternative |
|---|---|---|---|
| Frontend | React 18 + Vite + TailwindCSS + shadcn/ui | **C** | Vite dev server is instant; shadcn gives a serious-looking dashboard in minutes |
| Charts | Recharts | **C** | PSNR-vs-DELTA curve and attack-survival bars |
| Wallet | MetaMask + wagmi + viem | **C** | Lets the jury see the chain write happen live in the browser |
| Backend | Node.js 20 + Express | **B** | Everyone knows it. **NestJS is banned** — decorators + modules = wasted hours |
| File upload | Multer (memory storage) | **B** | No disk writes needed; buffers go straight to Sharp |
| Validation | Zod | **B** | One schema per route, throws clean 400s |
| Image processing | Sharp (fast decode/resize) + Jimp (raw pixel access) | **A** | Sharp for I/O, Jimp as the always-works fallback if Sharp's native binary fails |
| Watermark | **Hand-written Haar DWT + QIM** (no library) | **A** | ~30 lines, and "humne khud likha" scores heavily in viva |
| Error correction | `@ronomon/reed-solomon` | **A** | BCH has poor JS support; RS package is ready-made |
| Perceptual hash | `sharp-phash` + hand-rolled dHash/aHash | **A** | Three hashes voting > one hash alone |
| Encryption | Node built-in `crypto` — AES-256-GCM | **A** | Zero deps, and GCM self-detects tampering |
| Content hash | Node `crypto` — SHA-256 (+ MD5 for registry fingerprint only) | **A** | SHA-256 for security; MD5 only because the PS asks for a registry fingerprint |
| Smart contract | Solidity 0.8.24 + Hardhat + ethers.js v6 | **B** | The entire Ethereum toolchain is JS — this is why Node was the right call |
| Contract library | OpenZeppelin (`AccessControl`) | **B** | Role-gating `logDecryption` without writing auth from scratch |
| Chain | **Sepolia** testnet for demo + **local Hardhat node** for dev | **B** | Sepolia gives a public Etherscan link the jury can click |
| Database | PostgreSQL 16 + Prisma ORM | **B** | `prisma migrate dev` = schema to DB in one command |
| Search index | Hand-written BK-tree (in-memory, rebuilt on boot) | **B** | 40 lines, 10k files searched in <1s, no pgvector setup cost |
| Job queue | BullMQ + Redis | **B** *(optional, only if time permits)* | Watermarking is slow; background it only if the sync path feels laggy |
| IPFS | Pinata API via axios | **B** *(optional)* | Nice-to-have: store the encrypted blob off-server |

### Install commands (run at home, NOT at the venue)

```bash
# ---------- BACKEND (Person B, with A's deps) ----------
npm i express multer cors dotenv zod
npm i sharp jimp sharp-phash @ronomon/reed-solomon
npm i ethers pg @prisma/client
npm i -D prisma nodemon

# ---------- BLOCKCHAIN (Person B) ----------
npm i -D hardhat @nomicfoundation/hardhat-toolbox
npm i @openzeppelin/contracts

# ---------- FRONTEND (Person C) ----------
npm create vite@latest client -- --template react
cd client
npm i axios recharts wagmi viem @tanstack/react-query
npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
```

> **WARNING: Zip your `node_modules` and carry it on a pendrive.** Venue Wi-Fi will not cooperate. This single step has saved more SIH teams than any code.

---

## 3. Blockchain vs PostgreSQL — Exact Split

This is the section the jury will probe. Everyone must be able to answer it.

### What goes ON-CHAIN (tiny, immutable, privacy-safe)

Only the facts that become worthless if someone can edit them. Each record costs gas, so it is 5 × `bytes32` + a timestamp.

| Field | Type | Why on chain |
|---|---|---|
| `receiptId` | `bytes32` | The unique parchi ID; the watermark points back to this |
| `assetRef` | `bytes32` | `keccak256(assetId \|\| salt)` — which document |
| `userRef` | `bytes32` | `keccak256(userId \|\| salt)` — **hashed, never the name** |
| `contentSha` | `bytes32` | SHA-256 of the exact bytes that were released |
| `payloadCommit` | `bytes32` | `keccak256(payloadBits \|\| salt)` — proves the mark was decided *before* the leak, not fabricated after |
| `timestamp` | `uint64` | Block-anchored time — cannot be back-dated |

### What stays in POSTGRESQL (big, searchable, private)

Everything we need to *find* things fast, plus everything that must not be public.

- Real names, departments, device labels → the plaintext identity behind `userRef`
- `pHash` / `dHash` / `aHash` → the BK-tree search index
- `psnrDb`, `deltaUsed` → quality metrics for the graph
- Encrypted file blobs / paths, titles, classification labels
- Investigation history, candidate lists, confidence scores
- `txHash` + `blockNumber` → the pointer back to the chain record

### The one-sentence answer for the viva

> *"Chain pe sirf wo cheez hai jo badalne se saboot khatam ho jata — aur wo bhi hashed. Naam, index, aur speed ke liye PostgreSQL hai. Blockchain proof deta hai, Postgres search deta hai."*

---

## 4. FROZEN INTERFACES (agree at Hour 2, do not change silently)

These are what let three people build simultaneously without waiting for each other. Put this in a file `docs/CONTRACTS.md` and paste it in the team WhatsApp group.

### 4.1 Person A's module exports (`server/core/`)

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

// server/core/confidence.js  -- owner: A
/**
 * @param {{ bitConfidence:number, pHashDist:number, dHashDist:number,
 *           aHashDist:number, chainVerified:boolean }} sig
 * @returns {{ score:number, verdict:'ATTRIBUTED'|'PROBABLE'|'INCONCLUSIVE',
 *             reasons:string[] }}
 */
export function score(sig) {}
```

### 4.2 Person B's API contract (consumed by C)

```jsonc
// POST /api/assets           (multipart: file, title, classification)
// -> 201
{ "assetId": 12, "title": "Ops Order 44", "sha256": "ab34...", "sizeBytes": 402193 }

// GET /api/assets
// -> 200
{ "assets": [ { "assetId":12, "title":"...", "classification":"CONFIDENTIAL",
                "createdAt":"2026-03-12T14:22:00Z", "decryptCount": 7 } ] }

// POST /api/decrypt          { assetId, userId, deviceLabel }
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

// POST /api/trace            (multipart: file)
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

// GET /api/audit/:assetId
// -> 200
{ "assetId":12, "timeline":[
    { "receiptId":"0x7f2c...", "userName":"Officer U-017", "at":"...",
      "device":"DESK-114", "txHash":"0x9ab1...", "psnrDb":42.7 } ] }

// GET /api/metrics
// -> 200
{
  "attacks": [
    { "name":"JPEG q90", "survived":true,  "bitsRecovered":48, "psnrDb":41.2 },
    { "name":"JPEG q75", "survived":true,  "bitsRecovered":47, "psnrDb":38.4 },
    { "name":"JPEG q60", "survived":true,  "bitsRecovered":45, "psnrDb":35.1 },
    { "name":"JPEG q45", "survived":true,  "bitsRecovered":43, "psnrDb":32.6 },
    { "name":"Resize 50%","survived":true, "bitsRecovered":44, "psnrDb":null },
    { "name":"Crop 20%", "survived":true,  "bitsRecovered":41, "psnrDb":null },
    { "name":"Gaussian noise","survived":true,"bitsRecovered":42,"psnrDb":null },
    { "name":"Screenshot sim","survived":true,"bitsRecovered":40,"psnrDb":null }
  ],
  "psnrCurve": [ { "delta":4,"psnrDb":51.2,"bitsRecovered":31 },
                 { "delta":8,"psnrDb":46.8,"bitsRecovered":44 },
                 { "delta":12,"psnrDb":42.7,"bitsRecovered":48 },
                 { "delta":16,"psnrDb":39.1,"bitsRecovered":48 },
                 { "delta":24,"psnrDb":34.0,"bitsRecovered":48 } ]
}
```

**Error shape for every route:** `{ "error": { "code": "BAD_INPUT", "message": "..." } }`

### 4.3 The 48-bit payload layout (A and B must both know this)

```
 bit  0 ... 35   ->  first 36 bits of receiptId  (2^36 receipts = plenty)
 bit 36 ... 43   ->  8-bit CRC over bits 0-35    (catches bad extractions)
 bit 44 ... 47   ->  4-bit version / delta tag   (future-proofing)
 ---------------------------------------------------------------
 48 bits --RS encode--> ~96 bits --5x repeat--> ~480 DWT coefficients
```

`receiptId` → 36-bit short-id mapping lives in the `DecryptionEvent` table, so B can always look up the full receipt from what A extracts.

---

## 5. PERSON A — Core Engine (Watermark · Crypto · Matching Math)

> **Role in one line:** You build the part that makes this project exist. Nobody can start meaningfully until your `embed()` works.
>
> **You own:** `server/core/*.js`, `test/attack-suite.js`
> **You do NOT touch:** Express routes, Prisma, React, Solidity.
> **You never need the DB or the network** — everything you write is a pure function on Buffers. Test with local image files.

### 5.1 Your deliverables

| # | File | What it must do |
|---|---|---|
| A1 | `core/crypto.js` | AES-256-GCM encrypt/decrypt, SHA-256, MD5, key derivation from a passphrase (`scrypt`) |
| A2 | `core/watermark.js` | **THE BIG ONE.** Haar DWT (2-level) → QIM embed into HL & LH → inverse DWT → JPEG-safe output. Plus `extract()` |
| A3 | `core/ecc.js` | Reed-Solomon wrap/unwrap around the 48-bit payload + CRC-8 |
| A4 | `core/phash.js` | pHash (DCT-based), dHash (neighbour-diff), aHash (average), plus Hamming distance |
| A5 | `core/confidence.js` | Weighted score → verdict band → human-readable `reasons[]` |
| A6 | `core/psnr.js` | PSNR between original and marked buffer (for the invisibility claim) |
| A7 | `test/attack-suite.js` | 8 attacks, prints a table, writes `metrics.json` that B serves at `/api/metrics` |

### 5.2 Algorithm decisions (already made — just implement)

**Watermark: Haar DWT, embed in HL + LH sub-bands.**

```
LL -> don't touch, mark becomes visible
HH -> don't touch, JPEG quantisation destroys it
HL + LH -> the sweet spot  <-- YES
```

```js
// 1-D Haar wavelet — the entire transform
function haar1D(a) {
  const n = a.length, half = n >> 1;
  const low = new Float64Array(half), high = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    low[i]  = (a[2*i] + a[2*i+1]) / 2;   // average    -> low frequency
    high[i] = (a[2*i] - a[2*i+1]) / 2;   // difference -> high frequency
  }
  return { low, high };
}
// 2-D = apply to every row, then to every column.
// Result quadrants: LL | HL
//                   LH | HH
```

**Bit embedding: QIM (Quantisation Index Modulation).**

```js
const DELTA = 12;                         // strength — tune this

function embedBit(c, bit) {
  const q = Math.floor(c / DELTA);
  return DELTA * (q + (bit === 0 ? 0.25 : 0.75));
}
function extractBit(c) {
  const r = ((c % DELTA) + DELTA) % DELTA / DELTA;
  return r < 0.5 ? 0 : 1;
}
// DELTA  4  -> invisible but fragile
// DELTA 24  -> survives everything but faintly visible
// DELTA 8-16 -> sweet spot. Measure, don't guess.
```

**Coefficient selection:** do not embed into the first N coefficients in raster order — a crop kills them all. Use a **keyed pseudo-random permutation** of the HL/LH coefficient indices (seed = a fixed project secret) and spread each bit across 5 scattered positions. Majority-vote on extraction. This is what makes crop attacks survivable.

**Perceptual hashes: use all three, OR-vote.**

| Hash | Method | Role |
|---|---|---|
| dHash | neighbour-pixel difference | **PRIMARY** — survives resize + compression best |
| pHash | DCT low frequencies | Strongest overall, second opinion |
| aHash | average brightness | Cheap baseline, catches brightness-shifted screenshots |

> If **any one** of the three is within threshold, keep the row as a candidate. This one-line change is what catches screenshot-of-a-screen leaks that pHash alone misses.

**Confidence formula (implement exactly this, then tune weights):**

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

Always populate `reasons[]` with plain sentences. The jury reads those, not the number.

### 5.3 Your attack suite (A7) — this table wins the round

| # | Attack | How to produce it | Target |
|---|---|---|---|
| 1 | JPEG quality 90 | `sharp(buf).jpeg({quality:90})` | 48/48 bits |
| 2 | JPEG quality 75 | same, q=75 | >=46/48 |
| 3 | JPEG quality 60 | same, q=60 | >=44/48 |
| 4 | JPEG quality 45 | same, q=45 | >=41/48 |
| 5 | Resize 50% then back up | `sharp().resize(w/2).resize(w)` | >=43/48 |
| 6 | Crop 20% from edges | `sharp().extract({...})` | >=40/48 |
| 7 | Gaussian noise sigma=5 | add per-pixel noise via Jimp | >=42/48 |
| 8 | "Screenshot" simulation | resize → JPEG q70 → slight brightness shift | >=40/48 |

Output a console table **and** write `test/metrics.json` so Person B can serve it verbatim.

### 5.4 Person A — hour-by-hour

| Hours | Task | Done when |
|---|---|---|
| 0–2 | Setup, Sharp + Jimp working on your laptop, grab 10 sample images | `sharp(img).metadata()` prints |
| 2–4 | `haar2D()` forward + inverse. Reconstruct an image with zero visible loss | PSNR(original, inverse(forward(x))) > 50 dB |
| 4–6 | QIM embed/extract on HL+LH, **no attacks yet**, 48 bits round-trip | 48/48 bits on a clean PNG |
| 6–8 | JPEG q75 survival. Tune DELTA. Add keyed coefficient spreading | >=46/48 after JPEG q75 ← **GO/NO-GO GATE** |
| 8–10 | `crypto.js` + `psnr.js`. Hand A1 to B so `/api/assets` unblocks | B can encrypt a file |
| 10–13 | `phash.js` — all three hashes + Hamming | Hashes of a resized image differ by <8 |
| 13–16 | `ecc.js` Reed-Solomon + CRC-8 wrapper | Flip 3 bits manually → still recovers |
| 16–19 | `confidence.js` + `reasons[]` generation | Returns all 3 bands on crafted inputs |
| 19–24 | **Attack suite.** Run all 8, tune DELTA, regenerate `metrics.json` | 8/8 rows survive |
| 24–28 | Support B during integration; fix whatever the real pipeline breaks | End-to-end trace returns ATTRIBUTED |
| 28–33 | PSNR-vs-DELTA curve data, before/after image pair for the demo | `metrics.json` has `psnrCurve` |
| 33–36 | Freeze. Rehearse your 90-second explanation of DWT+QIM for the viva | You can draw the LL/HL/LH/HH box from memory |

### 5.5 Person A — risks & fallbacks

| Risk | Fallback |
|---|---|
| `sharp` native install fails at the venue | Full Jimp path (`jimp` is pure JS, never fails). Write `phash.js` Jimp-first. |
| Bits die at JPEG q60 | Raise DELTA to 16–20 and accept PSNR ~38 dB. 38 dB is still invisible to the eye. |
| DWT maths is fighting you past Hour 8 | Fall back to **block-DCT + QIM** on 8×8 blocks (mid-frequency coefficients). Weaker story, same demo. Do not fall back to LSB — it dies on the first JPEG save. |
| Reed-Solomon package misbehaves | Drop to 5× repetition + majority vote. You already have that as the spreading layer. |

---

## 6. PERSON B — Blockchain + Backend + Database

> **Role in one line:** You are the spine. You own the chain, the API, and the data model — the two other members plug into you.
>
> **You own:** `contracts/`, `scripts/`, `hardhat.config.js`, `server/index.js`, `server/routes/`, `server/core/chain.js`, `server/core/bktree.js`, `prisma/`
> **You do NOT touch:** `core/watermark.js`, `core/phash.js`, `core/confidence.js` (A's), `client/` (C's).

### 6.1 Your deliverables

| # | File | What it must do |
|---|---|---|
| B1 | `contracts/DecryptionProvenance.sol` | Store receipts on-chain, emit events, role-gated writes |
| B2 | `scripts/deploy.js` + `hardhat.config.js` | Deploy to local Hardhat **and** Sepolia; print address |
| B3 | `core/chain.js` | ethers v6 wrapper: `logDecryption()`, `getReceipt()`, `buildEtherscanUrl()` |
| B4 | `prisma/schema.prisma` + migrations | 4 models (§6.3), seeded with 5 users + 3 assets |
| B5 | `server/index.js` | Express app, CORS, Multer, Zod error middleware, health check |
| B6 | `routes/assets.js` | Upload → SHA-256 → AES encrypt → store → list |
| B7 | `routes/decrypt.js` | **The orchestrator.** decrypt → chain write → payload → watermark → hashes → DB → return |
| B8 | `routes/trace.js` | hashes → BK-tree candidates → extract bits → confidence → verdict → persist investigation |
| B9 | `routes/audit.js` + `routes/metrics.js` | Timeline per asset; serve A's `metrics.json` |
| B10 | `core/bktree.js` | BK-tree over 64-bit hashes, Hamming metric, built at boot from DB |

### 6.2 Smart contract — what to write

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract DecryptionProvenance is AccessControl {
    bytes32 public constant LOGGER_ROLE = keccak256("LOGGER_ROLE");

    struct Receipt {
        bytes32 assetRef;       // keccak256(assetId || salt)
        bytes32 userRef;        // keccak256(userId  || salt)  <- privacy
        bytes32 contentSha;     // SHA-256 of released bytes
        bytes32 payloadCommit;  // keccak256(payloadBits || salt)
        uint64  timestamp;
        bool    exists;
    }

    mapping(bytes32 => Receipt) private receipts;   // receiptId -> Receipt
    mapping(bytes32 => bytes32[]) private byAsset;  // assetRef  -> receiptIds

    event DecryptionLogged(
        bytes32 indexed receiptId,
        bytes32 indexed assetRef,
        bytes32 indexed userRef,
        bytes32 contentSha,
        bytes32 payloadCommit,
        uint64  timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LOGGER_ROLE, msg.sender);
    }

    function logDecryption(
        bytes32 receiptId, bytes32 assetRef, bytes32 userRef,
        bytes32 contentSha, bytes32 payloadCommit
    ) external onlyRole(LOGGER_ROLE) {
        require(!receipts[receiptId].exists, "receipt exists");
        receipts[receiptId] = Receipt(assetRef, userRef, contentSha,
                                      payloadCommit, uint64(block.timestamp), true);
        byAsset[assetRef].push(receiptId);
        emit DecryptionLogged(receiptId, assetRef, userRef,
                              contentSha, payloadCommit, uint64(block.timestamp));
    }

    function getReceipt(bytes32 receiptId) external view returns (Receipt memory) {
        require(receipts[receiptId].exists, "unknown receipt");
        return receipts[receiptId];
    }

    function receiptsOfAsset(bytes32 assetRef) external view returns (bytes32[] memory) {
        return byAsset[assetRef];
    }

    // Stretch: Merkle batching -- 50 receipts, 1 transaction
    function logBatch(bytes32 merkleRoot, uint32 count) external onlyRole(LOGGER_ROLE) { /* ... */ }
}
```

**Deployment plan:**
1. Hours 8–10: deploy to **local Hardhat node** so nothing blocks on faucet/RPC.
2. Hours 10–14: deploy to **Sepolia**, save the address in `.env`, verify on Etherscan.
3. Keep a `CHAIN_MODE=local|sepolia` env flag so a dead RPC at the venue cannot kill the demo.

> **DO THIS ONE WEEK BEFORE THE HACKATHON:** get Sepolia test ETH from a faucet (sepoliafaucet.com / Alchemy / Infura faucet) into the demo wallet. Faucets rate-limit and sometimes require a mainnet balance. Teams die here every single year.

### 6.3 Prisma schema (write this at Hour 2, migrate immediately)

```prisma
// prisma/schema.prisma

model Asset {
  id             Int      @id @default(autoincrement())
  title          String
  classification String?                    // RESTRICTED / CONFIDENTIAL / SECRET
  cipherPath     String?                    // where the AES blob lives
  iv             Bytes?
  authTag        Bytes?
  originalSha    Bytes
  createdAt      DateTime @default(now())
  events         DecryptionEvent[]
}

model User {
  id      Int     @id @default(autoincrement())
  name    String                            // real name -- NEVER goes on chain
  userRef Bytes   @unique                   // keccak256(userId || salt)
  dept    String?
  events  DecryptionEvent[]
}

model DecryptionEvent {
  id          Int      @id @default(autoincrement())
  receiptId   Bytes    @unique              // 32 bytes
  shortId     BigInt   @unique              // the 36 bits inside the watermark
  asset       Asset    @relation(fields: [assetId], references: [id])
  assetId     Int
  user        User     @relation(fields: [userId], references: [id])
  userId      Int
  deviceRef   Bytes?
  deviceLabel String?
  contentSha  Bytes                         // SHA-256 of the marked file
  md5Digest   Bytes                         // registry fingerprint (PS requirement)
  pHash       BigInt
  dHash       BigInt?
  aHash       BigInt?
  payloadBits String                        // the 48 bits we embedded
  txHash      Bytes?                        // blockchain receipt
  blockNumber BigInt?
  deltaUsed   Int
  psnrDb      Float
  createdAt   DateTime @default(now())

  @@index([pHash])
  @@index([dHash])
  @@index([assetId])
}

model Investigation {
  id           Int      @id @default(autoincrement())
  uploadedSha  Bytes
  candidates   Int
  topReceiptId Bytes?
  confidence   Float
  verdict      String                        // ATTRIBUTED / PROBABLE / INCONCLUSIVE
  reasons      String[]
  elapsedMs    Int?
  createdAt    DateTime @default(now())
}
```

### 6.4 The `/api/decrypt` orchestration (B7) — write it in this exact order

```
 1. Zod-validate { assetId, userId, deviceLabel }
 2. Load Asset + User from Postgres
 3. plaintext = crypto.decrypt(asset.cipher, key, iv, authTag)        [A's code]
 4. contentSha = crypto.sha256(plaintext)                             [A's code]
 5. receiptId  = keccak256(assetRef || userRef || contentSha || nonce)
 6. payloadBits = buildPayload(receiptId)   // 36-bit shortId + CRC8 + version
 7. payloadCommit = keccak256(payloadBits || SALT)
 8. tx = await chain.logDecryption(receiptId, assetRef, userRef,
                                   contentSha, payloadCommit)      <-- ON CHAIN
 9. { buffer, psnrDb } = await watermark.embed(plaintext, payloadBits, DELTA)  [A]
10. { pHash, dHash, aHash } = await phash.hashes(buffer)              [A's code]
11. INSERT DecryptionEvent { ..., txHash: tx.hash, blockNumber }   <-- POSTGRES
12. bktree.insert(dHash, eventId)                                 // keep index hot
13. return the JSON from §4.2 (with etherscanUrl built by chain.js)
```

> **Order matters:** chain write happens *before* the watermark is handed over. If the chain write fails, no marked file ever leaves the system — so there can never be a marked file without a receipt.

### 6.5 The `/api/trace` flow (B8)

```
 1. Multer -> buffer
 2. hashes(buffer)                                        [A]
 3. bktree.search(dHash, maxDist=12) U search(pHash) U search(aHash) -> candidates
 4. watermark.extract(buffer) -> { payloadBits, bitConfidence }       [A]
 5. shortId = payloadBits[0..35] -> look up DecryptionEvent (O(1) index)
 6. Cross-check: chain.getReceipt(receiptId) -> chainVerified = true/false
 7. confidence.score({ bitConfidence, pHashDist, dHashDist, aHashDist, chainVerified })  [A]
 8. INSERT Investigation
 9. Return match ONLY if verdict !== 'INCONCLUSIVE'; otherwise match = null
```

### 6.6 Person B — hour-by-hour

| Hours | Task | Done when |
|---|---|---|
| 0–2 | Postgres 16 running, Prisma init, **freeze `docs/CONTRACTS.md`** with C and A | `prisma migrate dev` succeeds |
| 2–4 | Full schema + seed script (5 users, 3 assets) | `prisma studio` shows seeded rows |
| 4–6 | Express skeleton + CORS + Multer + Zod middleware + `/api/health` | C can hit `/api/health` from Vite |
| 6–8 | **Mock all 5 endpoints returning §4.2 fixtures** | C is fully unblocked and never waits for you again |
| 8–11 | `DecryptionProvenance.sol` + tests + deploy to local Hardhat | `npx hardhat test` green |
| 11–14 | `chain.js` with ethers v6 + **deploy to Sepolia** + Etherscan link | Real txHash printed from a script |
| 14–17 | `/api/assets` real (upload + SHA + AES via A's `crypto.js`) | File uploads, row appears |
| 17–20 | `/api/decrypt` real — full 13-step orchestration | **Etherscan link works end-to-end** |
| 20–24 | `bktree.js` + rebuild-on-boot + `/api/trace` real | Leaked file returns ATTRIBUTED |
| 24–28 | `/api/audit/:assetId`, `/api/metrics`, error handling, 404/500 shapes | All 5 routes real, mocks deleted |
| 28–32 | Hardening: invalid file types, huge files, chain-RPC-down fallback, `CHAIN_MODE` flag | Demo survives Wi-Fi dying |
| 32–36 | Freeze. Prepare the "why chain + why Postgres" viva answer (§3) | You can answer without notes |

### 6.7 Person B — risks & fallbacks

| Risk | Fallback |
|---|---|
| Sepolia RPC dead / out of test ETH at the venue | `CHAIN_MODE=local` → local Hardhat node with a pre-funded account. Show Etherscan from a **recorded** earlier transaction. |
| Postgres install trouble on a teammate's laptop | Docker: `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16`. Have the image pre-pulled. |
| Prisma migration conflicts between members | **Only B runs migrations.** Others run `prisma migrate deploy` + `generate`. |
| Gas too expensive / tx too slow for a live demo | Merkle-batch 50 receipts into 1 tx (the `logBatch` stub) — also a strong talking point. |

---

## 7. PERSON C — Frontend, Integration & Demo

> **Role in one line:** You own everything the jury actually sees. A brilliant engine with an ugly UI loses to a decent engine with a sharp dashboard.
>
> **You own:** `client/` entirely, the demo script, the video, the 6-slide deck, deployment.
> **You do NOT touch:** `server/`, `contracts/`, `prisma/`.
> **You are never blocked** — B hands you mock endpoints at Hour 8; build against those from Hour 2 with a local JSON stub if needed.

### 7.1 Your deliverables

| # | Screen / artefact | What it shows |
|---|---|---|
| C1 | **Shell** — sidebar, dark theme, header with MetaMask connect button | Looks like a real government security console, not a college project |
| C2 | **Assets** — table of documents + upload dialog | Title, classification badge, decrypt count, created-at |
| C3 | **Decrypt** — pick asset + officer + device → big Decrypt button | On success: receipt card, **live Etherscan link**, PSNR value, download marked file |
| C4 | **Before / After** — original vs marked, side by side, with a slider | Caption: *"PSNR 42.7 dB — farak aankh se dikhta hi nahi"* |
| C5 | **Trace** — drag-drop a leaked file → animated analysis → verdict card | Big colour-coded verdict + confidence ring + `reasons[]` list + matched officer |
| C6 | **Timeline** — per-asset audit trail | Who opened it, when, from which device, each row linking to Etherscan |
| C7 | **Robustness** — Recharts | Bar chart: 8 attacks × bits recovered. Line chart: PSNR vs DELTA |
| C8 | **Demo kit** | 60-second script, recorded video, 6-slide deck, deployed URLs |

### 7.2 Design rules (non-negotiable — this is where marks are won)

1. **Verdict colours:** `ATTRIBUTED` = emerald, `PROBABLE` = amber, `INCONCLUSIVE` = slate-grey. Never red — we are not accusing anyone.
2. **The INCONCLUSIVE screen must look just as polished as the ATTRIBUTED one.** Showing the system confidently say *"pata nahi"* is a feature, not an error state. Put a line on it: *"System guess nahi karta."*
3. **Always show `reasons[]` as a bulleted list** under the confidence number. Explainability beats a bare percentage.
4. **Etherscan links open in a new tab** and are visually prominent — the jury will click one.
5. **Never render a real name next to a blockchain field.** Show `userRef: 0x8f3a...` on the chain card and the name only in the Postgres-sourced panel. Label them: *"On-chain (hashed)"* vs *"Internal registry"*. This visual separation sells the privacy design in two seconds.
6. **No loading spinner without text.** Watermarking takes seconds — show *"Embedding invisible mark (Haar DWT, Δ=12)..."*. Perceived competence.

### 7.3 Wallet / MetaMask integration

Use wagmi + viem. Two modes, switchable in the UI:

- **Server-signed (default):** backend holds the key, writes the receipt. Reliable, always works.
- **Wallet-signed (demo flourish):** the officer's MetaMask signs the `logDecryption` transaction in the browser. The jury watches the MetaMask popup appear. Higher wow, higher risk — keep it behind a toggle and demo it only if it's stable.

### 7.4 Person C — hour-by-hour

| Hours | Task | Done when |
|---|---|---|
| 0–2 | Vite + Tailwind + shadcn scaffold, routing, **review `docs/CONTRACTS.md`** with B | `npm run dev` shows the shell |
| 2–6 | C1 shell + C2 assets table against a local JSON stub | Layout looks finished on fake data |
| 6–10 | C3 decrypt screen + receipt card + Etherscan link (against B's mocks) | Clicking Decrypt renders the receipt |
| 10–14 | C5 trace screen — dropzone, analysis animation, all three verdict states | You can force each of the 3 verdicts via a dev switch |
| 14–18 | C6 timeline + C4 before/after slider | Timeline rows link to Etherscan |
| 18–20 | **Switch from mocks to B's real API.** Fix shape mismatches together | Real decrypt works in the browser |
| 20–24 | C7 Recharts — attack bar chart + PSNR/DELTA curve from `/api/metrics` | Both charts render live data |
| 24–28 | MetaMask connect + wallet-signed mode behind a toggle | Popup appears and tx confirms |
| 28–31 | Polish: empty states, errors, toasts, mobile-ish sizing, favicon, project name | Nothing looks unfinished |
| 31–33 | **Deploy** — frontend on Vercel, backend on Render/Railway, Postgres on Neon/Supabase | Public URL loads |
| 33–35 | **Record the demo video** (2 takes) + build the **6-slide deck** | Video under 3 minutes |
| 35–36 | Two full dry runs of the 60-second demo with the whole team | Timed under 90 seconds |

### 7.5 Person C — risks & fallbacks

| Risk | Fallback |
|---|---|
| Backend not ready when you need it | You have mocks. Keep a `VITE_USE_MOCKS=true` flag that works until the very last minute. |
| MetaMask refuses to connect at the venue | Toggle back to server-signed mode. Never make the demo depend on the wallet. |
| Deployment fails | Demo from `localhost`. Have the video as the ultimate backup. **The video is your insurance policy — record it by Hour 33, not Hour 35.** |
| Charts have no data because A's suite is late | Ship `metrics.json` as a static fixture in `client/public/` and swap to the live endpoint when ready. |

---

## 8. Shared Workflow Rules

### 8.1 Repository layout (create at Hour 0, everyone `git pull` before starting)

```
sih26237-provenance/
├── contracts/
│   └── DecryptionProvenance.sol           <- B
├── scripts/
│   └── deploy.js                          <- B
├── hardhat.config.js                      <- B
├── server/
│   ├── index.js                           <- B
│   ├── routes/
│   │   ├── assets.js   decrypt.js
│   │   └── trace.js    audit.js  metrics.js   <- B
│   ├── core/
│   │   ├── watermark.js    *** MODULE A ***   <- A
│   │   ├── phash.js   crypto.js
│   │   ├── ecc.js     psnr.js
│   │   ├── confidence.js                      <- A
│   │   └── chain.js   bktree.js               <- B
│   └── prisma/
│       ├── schema.prisma   seed.js            <- B
├── client/                                    <- C (entire folder)
│   └── src/{pages,components,lib,hooks}/
├── test/
│   ├── attack-suite.js                        <- A
│   └── metrics.json  (generated)
├── docs/
│   ├── CONTRACTS.md    <- frozen interfaces
│   └── DEMO-SCRIPT.md  <- C
└── .env.example
```

### 8.2 Git rules

- Branches: `feat/core-a`, `feat/backend-b`, `feat/client-c`. Merge to `main` **only at the integration checkpoints**.
- **Nobody edits a file they do not own.** Found a bug in someone else's file? Message them. Two people editing `decrypt.js` at Hour 25 is how projects die.
- Commit every 30–45 minutes. `git stash` is not a backup strategy.
- `.env` is gitignored; `.env.example` is committed with every key listed.

### 8.3 Integration checkpoints (whole team stops and syncs — 15 minutes each)

| Hour | Checkpoint | Pass criteria |
|---|---|---|
| **H2** | Contracts frozen | `docs/CONTRACTS.md` merged; all three agree on §4 |
| **H8** | **GO / NO-GO** | A: 46+/48 bits survive JPEG q75. B: mocks live. C: two screens built. **If A fails here, switch to the DCT fallback immediately.** |
| **H14** | Chain alive | Real Sepolia txHash exists; C can render an Etherscan link |
| **H20** | **FIRST FULL LOOP** | Upload → Decrypt → download marked → re-upload → get a verdict. Ugly is fine. It just has to run. |
| **H28** | Feature freeze | Everything real, no mocks left. **New features are now banned.** |
| **H33** | Demo freeze | Video recorded, deck done, two rehearsals complete |

### 8.4 The 4 mistakes that kill SIH teams (straight from the problem statement)

1. **Downloading packages at the venue.** Wi-Fi will not work. Carry `node_modules` on a pendrive.
2. **No Sepolia test ETH.** Get it from a faucet a full week early. Without it, you cannot write anything to the chain.
3. **`sharp` install failing.** Test on all three laptops at home. Keep Jimp as the pure-JS backup path.
4. **Starting integration at Hour 30.** Start at Hour 8 with mocks and integrate continuously. This plan is built around that.

---

## 9. The 60-Second Demo (rehearse this exactly)

| # | Action | Line to say | Owner |
|---|---|---|---|
| 1 | Click **Decrypt** on "Ops Order 44" as Officer U-017 | *"Officer file khol raha hai. Receipt abhi blockchain pe jaa rahi hai."* | C drives |
| 2 | Click the **Etherscan link** — live public transaction | *"Ye public Ethereum pe hai. Hum bhi ise mita nahi sakte."* | C |
| 3 | Show **before / after** side by side | *"Dono same dikh rahe hain na? PSNR 42.7 dB. Andar uska nishan hai."* | A explains |
| 4 | Run JPEG q60 + 50% resize on the marked file | *"Ab isko WhatsApp jaise kharab karte hain."* | C |
| 5 | Upload the damaged file to **Trace** | — | C |
| 6 | Verdict card appears | *"Officer U-017, 12 March 2026, 2:22 PM — **93% ATTRIBUTED**."* | B explains the chain cross-check |
| 7 | Upload a **random unrelated photo** | *"Aur agar system ko nahi pata — to wo saaf bolta hai: **INCONCLUSIVE**. Ye guess nahi karta."* | whole team |

> **Step 7 is the most important step in your entire demo.** It's what separates a team that understands forensic responsibility from a team that just built a matcher.

---

## 10. Stretch Goals — Only After Hour 28, Only If Frozen

Pick at most **two**. Attempting more will break what already works.

| Feature | Owner | Value | Cost |
|---|---|---|---|
| Reed-Solomon ECC | A | Meaningful robustness gain | Low (already planned) |
| Merkle batching (50 receipts → 1 tx) | B | 50× gas reduction; great talking point | Medium |
| PDF support (`pdf-lib` + Sharp, page-as-image) | A | Covers real government document formats | Medium |
| Steganalysis test (SRNet/XuNet via `onnxruntime-node`) | A | *"Even a CNN can't detect our mark"* — very strong | High |
| IPFS storage via Pinata | B | Decentralised blob store | Low |
| Wallet-signed transactions | C | Visual wow (MetaMask popup on stage) | Low |
| **Collusion resistance (Tardos codes)** | — | **Do NOT build.** Just say: *"Pata hai — 2 log copies mila de to fingerprint average ho jaata hai. Tardos codes hamara next step hai."* Showing you know the limit reads as maturity. | Zero |

---

## 11. Viva Question Bank (each member owns their answers)

| Question | Who answers | Answer |
|---|---|---|
| "Why blockchain? A database would work." | **B** | *"Agar chori usi department ne ki jo register sambhal raha hai, to wo apna naam mita dega. Chain pe likha record hum bhi nahi mita sakte."* |
| "Isn't storing user data on a public chain a privacy violation?" | **B** | *"Chain pe naam hai hi nahi — sirf `keccak256(userId \|\| salt)`. Naam sirf hamare private Postgres me hai."* |
| "Why not just LSB watermarking?" | **A** | *"Ek JPEG save pe LSB khatam. Humne Haar DWT ke HL/LH sub-band me QIM se daala — JPEG q45, resize, crop, sab survive karta hai. Yahi hamari attack table hai."* |
| "Why not use an AI model?" | **A** | *"Ye cryptography + signal processing ka problem hai, ML ka nahi. Isliye CPU-only chalta hai — na GPU, na training, na dataset."* |
| "What if the leaker crops the watermark out?" | **A** | *"Har bit 5 scattered positions pe keyed permutation se spread hai. 20% crop pe bhi 41/48 bits mile — table me hai."* |
| "What if two people collude?" | **A** | *"Fingerprints average ho jaate hain aur confidence girti hai. Tardos codes iska standard jawab hai — wo hamara next step hai."* |
| "How do we know you didn't fabricate the mark after the leak?" | **B** | *"`payloadCommit` decrypt ke waqt chain pe likha gaya tha, leak se pehle. Block timestamp jhooth nahi bol sakta."* |
| "What if your system is wrong?" | **C** | *"Isliye hum kabhi seedha naam nahi bolte. Teen bands hain, aur 60% se neeche system khulke bolta hai 'pata nahi'."* |
| "Why Node and not Python?" | **B** | *"Ethereum ka poora toolchain JS me hai — Hardhat, ethers, MetaMask. Python lete to bhi chain wala hissa Node me likhna padta. One language, one repo, no context switching."* |

---

## 12. Quick Reference — Who Does What

| | **Person A** | **Person B** | **Person C** |
|---|---|---|---|
| **Title** | Core Engine | Chain + Backend + DB | Frontend + Demo |
| **Owns** | `server/core/*` (except chain/bktree), `test/` | `contracts/`, `server/`, `prisma/` | `client/`, `docs/DEMO-SCRIPT.md` |
| **Main tech** | Sharp, Jimp, Haar DWT, QIM, Reed-Solomon, AES-GCM | Solidity, Hardhat, ethers v6, Express, Prisma, Postgres | React, Vite, Tailwind, shadcn, Recharts, wagmi |
| **Hardest hour** | 4–8 (watermark must survive JPEG) | 17–20 (full orchestration + chain) | 18–20 (mocks → real API) |
| **Critical gate** | H8: 46/48 bits after JPEG q75 | H14: live Sepolia txHash | H33: video recorded |
| **Blocks whom** | Blocks B at H14 and C at H20 | Blocks C at H18 | Blocks nobody |
| **Viva topic** | DWT, QIM, robustness, confidence math | Chain vs DB split, privacy, contract design | Explainability, verdict bands, UX of "pata nahi" |

---

### Final note

Three people, 36 hours, and one rule that matters more than the rest:

> **Hour 28 pe naya feature band. Uske baad sirf polish.**

A finished, rehearsed, slightly-simple demo beats an ambitious half-integrated one every single time.
