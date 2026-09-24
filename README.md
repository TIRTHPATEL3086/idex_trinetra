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

The UI opens on a sign-in screen. `npm run db:seed` prints one account per
role; `admin@example.gov` / `admin123` reaches every screen. See
[Roles](#roles).

`GET /api/health` reports database, chain and index status, and lists anything
degraded in `warnings`.

---

## Roles

Sign-in is required for everything except `/api/health`. Three roles, and the
split is the same separation-of-duties argument the verdict bands rest on:

| Role           | Documents    | Decrypt       | Trace | Timeline   | Robustness |
| -------------- | ------------ | ------------- | ----- | ---------- | ---------- |
| `ADMIN`        | view, upload | anyone        | yes   | everyone's | yes        |
| `OFFICER`      | view         | **self only** | no    | own only   | yes        |
| `INVESTIGATOR` | view         | **no**        | yes   | everyone's | yes        |

An investigator cannot decrypt, so the person who examines the evidence can
never mint a marked copy and manufacture the leak they then "discover". An
officer cannot trace, so nobody investigates their own leak, and `/api/decrypt`
refuses any `userId` but their own — a receipt names whoever the watermark will
identify, and releasing one in someone else's name is the exact failure this
system exists to prevent.

`server/lib/permissions.js` is the only place this table lives. The API
enforces it; the frontend reads the same capability list off `/api/auth/me` and
hides what it cannot do. Hiding a button is a courtesy — the refusal is the
control, and nothing in the client is trusted to make it.

**Seeded accounts** (`npm run db:seed` prints them):

| Role           | Email               | Password     |
| -------------- | ------------------- | ------------ |
| `ADMIN`        | `admin@example.gov` | `admin123`   |
| `OFFICER`      | `u017@example.gov`  | `officer123` |
| `INVESTIGATOR` | `a004@example.gov`  | `analyst123` |

Sessions are an httpOnly, SameSite=Lax cookie holding an HMAC-signed token
(`AUTH_SECRET`, 12 h by default). Passwords are scrypt. Both are built on
`node:crypto` — no bcrypt, no jsonwebtoken, nothing to install.

---

## API

Base path `/api`. Every failure returns `{ "error": { "code", "message" } }`.

| Method | Route                      | Purpose                                                           | Who                        |
| ------ | -------------------------- | ----------------------------------------------------------------- | -------------------------- |
| `GET`  | `/health`                  | Database, chain and index status                                  | anyone                     |
| `POST` | `/auth/login`              | Sign in, sets an httpOnly session cookie                          | anyone                     |
| `POST` | `/auth/logout`             | Clear the session                                                 | anyone                     |
| `GET`  | `/auth/me`                 | The current session and its capabilities                          | signed in                  |
| `GET`  | `/assets`                  | List protected documents                                          | signed in                  |
| `POST` | `/assets`                  | Upload and encrypt (multipart: `file`, `title`, `classification`) | admin                      |
| `GET`  | `/assets/:id`              | One document, with its refs                                       | signed in                  |
| `GET`  | `/users`                   | Officers, with their hashed `userRef`                             | all; an officer gets self  |
| `POST` | `/decrypt`                 | Release a watermarked copy and anchor the receipt                 | admin; officer for self    |
| `POST` | `/trace`                   | Attribute a leaked file (multipart: `file`)                       | admin, investigator        |
| `GET`  | `/trace/investigations`    | Recent investigations                                             | admin, investigator, audit |
| `GET`  | `/audit/:assetId`          | Per-document access timeline                                      | all; an officer gets own   |
| `GET`  | `/metrics`                 | Watermark robustness measurements                                 | signed in                  |
| `GET`  | `/files/marked/:receiptId` | Download a released copy                                          | admin, or the recipient    |

Error codes: `BAD_INPUT` · `UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` ·
`PAYLOAD_TOO_LARGE` · `UNSUPPORTED_MEDIA` · `CHAIN_ERROR` · `CORE_NOT_READY` ·
`INTERNAL`.

## Layout

```
contracts/         DecryptionProvenance.sol — role-gated receipt register
scripts/           deployment
prisma/            schema + seed
server/
  index.js         Express app and boot sequence
  routes/          auth · assets · decrypt · trace · audit · metrics · users · health
  middleware/      Zod validation, uploads, session + role guards, error shape
  lib/             config, Prisma client, ref hashing, auth, permissions, errors
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
client/            React + Vite + Tailwind dashboard (login, role-gated routes)
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

All core modules are fully implemented and verified:

- `server/core/watermark.js`: 2-level Haar DWT + QIM in HL/LH sub-bands with 21× redundancy.
- `server/core/ecc.js`: Pure-JS Reed-Solomon (12, 6) error correction & CRC bit repair.
- `server/core/phash.js`: pHash (2D-DCT), dHash, aHash perceptual hashing and 64-bit Hamming metric.
- `server/core/crypto.js`: AES-256-GCM encryption/decryption, SHA-256 digests.
- `server/core/pdf.js`: Document-level and microscopic per-page invisible provenance for PDFs.
- `server/core/confidence.js`: 3-band scoring (`ATTRIBUTED`, `PROBABLE`, `INCONCLUSIVE`).
- `test/attack-suite.js`: 8/8 robust attack benchmarks passing.
- `contracts/DecryptionProvenance.sol`: Deployed on Sepolia testnet and verified on local Hardhat.

## Contributing

Ownership is split three ways and each file header states its owner; do not
edit a file you do not own. Only one person runs `prisma migrate dev` —
everyone else runs `npx prisma migrate deploy && npx prisma generate`, so the
migration history stays linear.

## License

MIT — see [LICENSE](LICENSE).
