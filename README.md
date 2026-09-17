# Decryption Provenance

Tracing the source of a leaked classified document, without ever accusing
anyone the evidence does not support.

When a protected file is decrypted, the system does two things before the
plaintext is released: it writes an immutable receipt to a blockchain, and it
embeds an invisible, per-recipient watermark into the copy that is handed over.
If that copy later leaks — compressed, resized, cropped, or photographed off a
screen — the mark can still be recovered and matched back to the receipt.

Built for SIH problem statement **SIH26237**. Node.js + React + PostgreSQL,
CPU only: no GPU, no model, no training data.

---

## How it works

**Release.** Decrypt (AES-256-GCM) → hash the exact bytes → derive a receipt id
→ anchor `{receiptId, assetRef, userRef, contentSha, payloadCommit}` on chain →
embed the 48-bit payload with a 2-level Haar DWT and QIM in the HL/LH sub-bands
→ index the perceptual hashes → record the event.

The chain write happens _before_ the watermark is embedded. If it fails, no
marked file is ever released, so a marked copy cannot exist without a receipt.

**Trace.** Hash the leaked file → search the BK-tree index → extract the
watermark → look up the receipt → verify it on chain → score.

Two independent paths converge: the watermark identifies _which receipt_
(exact, but fragile under heavy attack) and the perceptual hashes identify
_which file_ (fuzzy, but survives a screenshot). Agreement earns confidence;
disagreement lowers it.

**The verdict is a band, never a name on its own:**

| Band           | Score       | Meaning                     |
| -------------- | ----------- | --------------------------- |
| `ATTRIBUTED`   | ≥ 0.85      | Report the match            |
| `PROBABLE`     | 0.60 – 0.85 | A lead, not a conclusion    |
| `INCONCLUSIVE` | < 0.60      | Report that it is not known |

Below the threshold the API returns `match: null`, so the frontend never
receives a name it is not allowed to show. Every verdict carries `reasons[]` in
plain sentences — a score that cannot be reviewed is not evidence.

## Privacy

No personal data reaches the blockchain. The only identity on chain is
`keccak256(userId || salt)`; names, departments and devices live in PostgreSQL
and never leave it.

| On chain                           | In PostgreSQL                                    |
| ---------------------------------- | ------------------------------------------------ |
| `receiptId`, `assetRef`, `userRef` | names, departments, device labels                |
| `contentSha`, `payloadCommit`      | perceptual hash index, PSNR, delta               |
| block timestamp                    | encrypted blobs, investigation history, `txHash` |

`payloadCommit` is written at decryption time, so the block timestamp proves
the watermark predates any leak rather than being constructed after one.

---

## Setup

Requires Node 20+, PostgreSQL 16, and npm.

```bash
git clone https://github.com/TIRTHPATEL3086/idex_trinetra.git
cd idex_trinetra
cp .env.example .env          # read the comments, set MASTER_KEY_HEX
npm run setup                 # installs root + client deps, generates Prisma client
```

**Database**

```bash
docker run --name sih-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
npm run db:migrate
npm run db:seed               # 5 officers, 3 encrypted documents
```

**Contract**

```bash
npm run chain:node            # terminal 1, leave running
npm run chain:deploy:local    # terminal 2, prints the address
# put the printed address in .env as LOCAL_CONTRACT_ADDRESS
```

`CHAIN_MODE` selects `local`, `sepolia` or `off`. Sepolia gives a publicly
verifiable Etherscan link; fund the wallet from a faucet well in advance.

**Run**

```bash
npm run dev                   # API  → http://localhost:4000
npm run client:dev            # UI   → http://localhost:5173
```

`GET /api/health` reports database, chain and index status, and lists anything
degraded in `warnings`.

---

## API

Base path `/api`. Every failure returns `{ "error": { "code", "message" } }`.

| Method | Route                      | Purpose                                                           |
| ------ | -------------------------- | ----------------------------------------------------------------- |
| `GET`  | `/health`                  | Database, chain and index status                                  |
| `GET`  | `/assets`                  | List protected documents                                          |
| `POST` | `/assets`                  | Upload and encrypt (multipart: `file`, `title`, `classification`) |
| `GET`  | `/assets/:id`              | One document, with its refs                                       |
| `GET`  | `/users`                   | Officers, with their hashed `userRef`                             |
| `POST` | `/decrypt`                 | Release a watermarked copy and anchor the receipt                 |
| `POST` | `/trace`                   | Attribute a leaked file (multipart: `file`)                       |
| `GET`  | `/trace/investigations`    | Recent investigations                                             |
| `GET`  | `/audit/:assetId`          | Per-document access timeline                                      |
| `GET`  | `/metrics`                 | Watermark robustness measurements                                 |
| `GET`  | `/files/marked/:receiptId` | Download a released copy                                          |

Error codes: `BAD_INPUT` · `NOT_FOUND` · `PAYLOAD_TOO_LARGE` ·
`UNSUPPORTED_MEDIA` · `CHAIN_ERROR` · `CORE_NOT_READY` · `INTERNAL`.

## Layout

```
contracts/         DecryptionProvenance.sol — role-gated receipt register
scripts/           deployment
prisma/            schema + seed
server/
  index.js         Express app and boot sequence
  routes/          assets · decrypt · trace · audit · metrics · users · health
  middleware/      Zod validation, uploads, the shared error shape
  lib/             config, Prisma client, ref hashing, error types
  core/
    watermark.js   Haar DWT + QIM embed/extract
    phash.js       pHash · dHash · aHash
    crypto.js      AES-256-GCM, SHA-256, MD5
    ecc.js         Reed-Solomon
    psnr.js        quality measurement
    confidence.js  score → band → reasons
    payload.js     48-bit payload codec
    chain.js       ethers v6 contract wrapper
    bktree.js      BK-tree over perceptual hashes
client/            React + Vite + Tailwind dashboard
test/              smoke test, attack suite, contract tests
```

## Commands

| Command                                        | Purpose                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                                  | API with reload                                           |
| `npm run client:dev`                           | Frontend dev server (proxies `/api`)                      |
| `npm run test:smoke`                           | Payload codec and BK-tree. No install or database needed  |
| `npm run attack:suite`                         | Eight attacks against the watermark → `test/metrics.json` |
| `npm run chain:test`                           | Contract tests                                            |
| `npm run db:migrate` · `db:seed` · `db:studio` | Prisma                                                    |
| `npm run lint` · `npm run format`              | ESLint, Prettier                                          |

## Status

`server/core/{watermark,phash,crypto,ecc,psnr,confidence}.js` are specified but
not yet implemented; calling one returns `503 CORE_NOT_READY` naming the module.
Everything else — contract, API, schema, indexing, chain integration — is built.

## Contributing

Ownership is split three ways and each file header states its owner; do not
edit a file you do not own. Only one person runs `prisma migrate dev` —
everyone else runs `npx prisma migrate deploy && npx prisma generate`, so the
migration history stays linear.

## License

MIT — see [LICENSE](LICENSE).
