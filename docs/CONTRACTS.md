# SIH26237 — Frozen System Contracts & Interfaces
**Version:** 1.0.0 (Hour 2 Freeze)  
**Status:** FROZEN — DO NOT ALTER WITHOUT TEAM CONSENSUS

This document serves as the immutable communication contract between:
- **Person A (Core Engine / Watermarking / Crypto)**
- **Person B (Blockchain / Express API / Database)**
- **Person C (Frontend / Web3 / Demo Kit)**

---

## 1. Person A's Module Exports (`server/core/`)

### 1.1 `server/core/watermark.js` (Owner: A)
```js
/**
 * Embeds 48-bit payload into image buffer using 2-level Haar DWT + QIM on HL & LH bands.
 * @param {Buffer} imageBuffer  original image bytes
 * @param {string} payloadBits  exactly 48 chars of '0'/'1'
 * @param {number} delta        QIM strength (default: 12)
 * @returns {Promise<{ buffer: Buffer, psnrDb: number, deltaUsed: number }>}
 */
export async function embed(imageBuffer, payloadBits, delta = 12);

/**
 * Extracts 48-bit payload from suspect image buffer.
 * @param {Buffer} imageBuffer  possibly attacked/compressed image
 * @returns {Promise<{ payloadBits: string, bitConfidence: number, eccCorrected: boolean }>}
 *          bitConfidence in [0,1] — fraction of bits recovered with agreement
 */
export async function extract(imageBuffer);
```

### 1.2 `server/core/phash.js` (Owner: A)
```js
/**
 * Calculates 3 perceptual hashes for robust image matching.
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ pHash: bigint, dHash: bigint, aHash: bigint }>}
 */
export async function hashes(imageBuffer);

/**
 * Computes Hamming distance between two 64-bit BigInt hashes.
 * @param {bigint} a
 * @param {bigint} b
 * @returns {number} Distance in range 0..64
 */
export function hamming(a, b);
```

### 1.3 `server/core/crypto.js` (Owner: A)
```js
export function encrypt(buffer, key); // -> { ciphertext: Buffer, iv: Buffer, authTag: Buffer }
export function decrypt(ciphertext, key, iv, authTag); // -> Buffer
export function sha256(buffer); // -> Buffer(32)
export function md5(buffer);    // -> Buffer(16)
```

### 1.4 `server/core/confidence.js` (Owner: A)
```js
/**
 * Evaluates forensic match confidence across signal sources.
 * Formula:
 *   score = 0.45 * bitAgreement
 *         + 0.25 * (1 - pHashDist/64)
 *         + 0.15 * (1 - dHashDist/64)
 *         + 0.10 * (1 - aHashDist/64)
 *         + 0.05 * (chainVerified ? 1 : 0);
 *
 * @param {{ bitConfidence: number, pHashDist: number, dHashDist: number, aHashDist: number, chainVerified: boolean }} sig
 * @returns {{ score: number, verdict: 'ATTRIBUTED'|'PROBABLE'|'INCONCLUSIVE', reasons: string[] }}
 */
export function score(sig);
```

---

## 2. Person B's REST API Contracts (Owner: B, Consumed by C)

### 2.1 Health Check
- **Endpoint:** `GET /api/health`
- **Response:**
```json
{
  "ok": true,
  "db": "connected",
  "chainMode": "sepolia", // "sepolia" | "local"
  "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "warnings": []
}
```

### 2.2 Assets Management
- **Endpoint:** `GET /api/assets`
- **Response:**
```json
{
  "assets": [
    {
      "assetId": 1,
      "title": "Ops Order 44 - Tactical Grid",
      "classification": "CONFIDENTIAL",
      "createdAt": "2026-03-12T14:22:00Z",
      "decryptCount": 7,
      "sha256": "ab34cf819e078da4b721865942fec75a02e60471b058c49925e0bc1ef1945620",
      "sizeBytes": 402193
    }
  ]
}
```

- **Endpoint:** `POST /api/assets` (Multipart form: `file`, `title`, `classification`)
- **Response (201):**
```json
{
  "assetId": 12,
  "title": "Ops Order 44",
  "sha256": "ab34cf819e078da4b721865942fec75a02e60471b058c49925e0bc1ef1945620",
  "sizeBytes": 402193
}
```

### 2.3 Decrypt & Watermark Release
- **Endpoint:** `POST /api/decrypt`
- **Request Body:**
```json
{
  "assetId": 1,
  "userId": 1,
  "deviceLabel": "DESK-114-SECURE"
}
```
- **Response (200):**
```json
{
  "receiptId": "0x7f2c8b41940efbc1294871d37ba6a9e10582098b672834b9d037e6f8b21c4901",
  "txHash": "0x9ab1c045b8214f9d0234857b612c0914a821e5401924b1049c6312a0f8b19283",
  "blockNumber": 5829301,
  "etherscanUrl": "https://sepolia.etherscan.io/tx/0x9ab1c045b8214f9d0234857b612c0914a821e5401924b1049c6312a0f8b19283",
  "payloadBits": "101101001101100010101100011010101101011010011010",
  "psnrDb": 42.7,
  "deltaUsed": 12,
  "downloadUrl": "/api/files/marked/7f2c8b41940efbc1294871d37ba6a9e10582098b672834b9d037e6f8b21c4901"
}
```

### 2.4 Trace & Forensic Investigation
- **Endpoint:** `POST /api/trace` (Multipart form: `file`)
- **Response (200):**
```json
{
  "investigationId": 31,
  "verdict": "ATTRIBUTED", // "ATTRIBUTED" | "PROBABLE" | "INCONCLUSIVE"
  "confidence": 0.93,
  "match": {
    "userName": "Officer U-017 (Capt. Rajesh Sharma)",
    "department": "Ops Wing",
    "assetTitle": "Ops Order 44 - Tactical Grid",
    "decryptedAt": "2026-03-12T14:22:00Z",
    "deviceLabel": "DESK-114-SECURE",
    "txHash": "0x9ab1c045b8214f9d0234857b612c0914a821e5401924b1049c6312a0f8b19283",
    "etherscanUrl": "https://sepolia.etherscan.io/tx/0x9ab1c045b8214f9d0234857b612c0914a821e5401924b1049c6312a0f8b19283"
  },
  "reasons": [
    "46/48 watermark bits recovered (2 fixed by Reed-Solomon)",
    "dHash distance 3/64 (survived perceptual compression)",
    "On-chain receipt verified (payloadCommit matches block #5829301)"
  ],
  "candidatesChecked": 1284,
  "elapsedMs": 812
}
```

*Note:* When `verdict === "INCONCLUSIVE"`, `match` is strictly `null`.

### 2.5 Audit Timeline & Metrics
- **Endpoint:** `GET /api/audit/:assetId`
- **Response:**
```json
{
  "assetId": 1,
  "title": "Ops Order 44 - Tactical Grid",
  "timeline": [
    {
      "receiptId": "0x7f2c8b41940efbc1294871d37ba6a9e10582098b672834b9d037e6f8b21c4901",
      "userName": "Officer U-017 (Capt. Rajesh Sharma)",
      "userRef": "0x8f3a9921b7e4a10c84e6123490bf712398daec6471902847a982147b01928471",
      "at": "2026-03-12T14:22:00Z",
      "device": "DESK-114-SECURE",
      "txHash": "0x9ab1c045b8214f9d0234857b612c0914a821e5401924b1049c6312a0f8b19283",
      "psnrDb": 42.7
    }
  ]
}
```

- **Endpoint:** `GET /api/metrics`
- **Response:**
```json
{
  "attacks": [
    { "name": "JPEG q90", "survived": true, "bitsRecovered": 48, "psnrDb": 41.2 },
    { "name": "JPEG q75", "survived": true, "bitsRecovered": 47, "psnrDb": 38.4 },
    { "name": "JPEG q60", "survived": true, "bitsRecovered": 45, "psnrDb": 35.1 },
    { "name": "JPEG q45", "survived": true, "bitsRecovered": 43, "psnrDb": 32.6 },
    { "name": "Resize 50%", "survived": true, "bitsRecovered": 44, "psnrDb": null },
    { "name": "Crop 20%", "survived": true, "bitsRecovered": 41, "psnrDb": null },
    { "name": "Gaussian noise", "survived": true, "bitsRecovered": 42, "psnrDb": null },
    { "name": "Screenshot sim", "survived": true, "bitsRecovered": 40, "psnrDb": null }
  ],
  "psnrCurve": [
    { "delta": 4, "psnrDb": 51.2, "bitsRecovered": 31 },
    { "delta": 8, "psnrDb": 46.8, "bitsRecovered": 44 },
    { "delta": 12, "psnrDb": 42.7, "bitsRecovered": 48 },
    { "delta": 16, "psnrDb": 39.1, "bitsRecovered": 48 },
    { "delta": 24, "psnrDb": 34.0, "bitsRecovered": 48 }
  ]
}
```

---

## 3. Privacy & On-Chain Separation Rules
1. **Never render real identity next to on-chain fields without explicit labels:**
   - Group 1: `On-Chain Hashed Proof` (`userRef`, `receiptId`, `txHash`, `payloadCommit`)
   - Group 2: `Internal Registry (Private)` (`Real Name`, `Department`, `Device`)
2. **Never send real names to the smart contract.**
3. **Verdict styling must be strictly:**
   - `ATTRIBUTED` = Emerald (`#10b981`)
   - `PROBABLE` = Amber (`#f59e0b`)
   - `INCONCLUSIVE` = Slate (`#64748b`)
   - **Never Red** — system does not accuse, and "Inconclusive" is a mathematically sound state.
