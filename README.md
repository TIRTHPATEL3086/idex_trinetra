# SIH26237 — Crypto Decryption Provenance

> **One line:** *"Jab koi secret file kholta hai, hum us copy me Haar-DWT se uska
> invisible nishan daal dete hain aur record blockchain pe likh dete hain. Baad
> me file leak ho, to kharab hui file se bhi nishan nikaal ke bata dete hain ki
> kisne, kab kholi thi — aur kitna pakka hai."*

| | |
|---|---|
| Problem Statement | **SIH26237** — Blockchain & Cybersecurity |
| Stack | Node.js 20 + React 18 + PostgreSQL 16 (CPU only, no GPU, no ML) |
| Team | 3 developers, 36 hours, one monorepo, one language |

---

## Read this before you write a line of code

All three of us must agree on these six facts. If one person is confused here,
integration at Hour 20 fails.

1. **Encryption is not the deliverable.** AES is 20 lines of built-in Node. The
   deliverable is what happens *after* decryption — the invisible mark and the
   immutable register.
2. **Module A (watermark) is the whole project.** If the mark does not survive
   JPEG compression, nothing else matters.
3. **Never say "this person did it" directly.** Three bands, always:
   `ATTRIBUTED (>=85%)` / `PROBABLE (60-85%)` / `INCONCLUSIVE (<60%)`.
4. **Names never go on the blockchain.** Only `keccak256(userId || salt)`. Real
   identity lives in PostgreSQL only.
5. **Blockchain = proof, PostgreSQL = search.**
6. **Nobody edits a file they do not own.** Found a bug in someone else's file?
   Message them.

---

## Who owns what

| | **Person A** | **Person B** | **Person C** |
|---|---|---|---|
| **Title** | Core Engine | Chain + Backend + DB | Frontend + Demo |
| **Owns** | `server/core/{watermark,phash,crypto,ecc,psnr,confidence}.js`, `test/` | `contracts/`, `scripts/`, `server/` (routes, lib, middleware), `server/core/{chain,bktree,payload}.js`, `prisma/` | `client/` entirely, `docs/DEMO-SCRIPT.md` |
| **Branch** | `feat/core-a` | `feat/backend-b` | `feat/client-c` |

**`docs/CONTRACTS.md` is frozen.** It holds every function signature, every API
response shape and the 48-bit payload layout. Read it first. Changing anything
in it means: message the group → all three agree → one commit that updates the
file *and* every caller.

---

## Getting started (15 minutes)

```bash
git clone https://github.com/TIRTHPATEL3086/idex_trinetra.git
cd idex_trinetra

cp .env.example .env            # then read the comments in it
npm install
npm --prefix client install
```

### 1. PostgreSQL

```bash
# easiest — no local install needed
docker run --name sih-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
createdb -h localhost -U postgres provenance   # or via any GUI
```

```bash
npm run db:migrate        # ONLY Person B runs this
npm run db:seed           # 5 officers + 3 protected documents
npm run db:studio         # optional — browse the rows
```

> **A and C:** never run `db:migrate`. Run `npx prisma migrate deploy && npx prisma generate`.
> Two people generating migrations is how the schema breaks.

### 2. Blockchain (local — never depends on the venue Wi-Fi)

```bash
npm run chain:node                  # terminal 1 — leave it running
npm run chain:compile
npm run chain:test                  # must be green
npm run chain:deploy:local          # terminal 2 — prints the address
# paste the printed address into .env as LOCAL_CONTRACT_ADDRESS
```

For the real demo link, switch `CHAIN_MODE=sepolia` and deploy there instead.
**Get Sepolia test ETH from a faucet a full week early.** Faucets rate-limit,
and teams die here every single year.

### 3. Run it

```bash
npm run dev            # API on http://localhost:4000
npm run client:dev     # UI  on http://localhost:5173
```

Check `http://localhost:4000/api/health` — it tells you in one request whether
Postgres is up, whether the chain is connected, and whether anything is still
running on a stand-in instead of Person A's real code.

---

## The two flags that keep everyone unblocked

| Flag | What it does | Turn it off by |
|---|---|---|
| `MOCK_MODE=true` | Every route returns the fixtures from `docs/CONTRACTS.md`. Person C builds complete screens without a working backend. | **Hour 28** |
| `ALLOW_CORE_FALLBACK=true` | When Person A's core is still a stub, the server substitutes a stand-in so the full Upload → Decrypt → Trace loop runs anyway. | As soon as A lands real code |

**The fallbacks are not the project.** The stand-in "watermark" appends bytes to
the end of the file and survives nothing; the stand-in "pHash" is not perceptual
at all. `/api/health` reports `coreFallback` as a loud array so this is never
discovered on stage. Delete `server/core/fallback/` at Hour 28.

---

## Layout

```
├── contracts/DecryptionProvenance.sol      <- B  receipts on chain, role-gated
├── scripts/deploy.cjs                      <- B
├── hardhat.config.cjs                      <- B  local + sepolia
├── prisma/{schema.prisma,seed.js}          <- B  4 models, 5 users, 3 assets
├── server/
│   ├── index.js                            <- B  express, cors, boot
│   ├── routes/                             <- B  assets decrypt trace audit metrics
│   ├── middleware/                         <- B  zod, multer, one error shape
│   ├── lib/                                <- B  env, prisma, refs, mocks, errors
│   └── core/
│       ├── watermark.js  phash.js          <- A  *** THE PROJECT ***
│       ├── crypto.js  ecc.js  psnr.js      <- A
│       ├── confidence.js                   <- A  score -> band -> reasons[]
│       ├── chain.js  bktree.js  payload.js <- B
│       ├── index.js                        <- B  resolves A's core or a stand-in
│       └── fallback/                       <- B  DELETE AT HOUR 28
├── client/                                 <- C  entire folder
├── test/attack-suite.js                    <- A  8 attacks -> metrics.json
├── test/smoke.mjs                          <- B  runs on a fresh clone, no deps
└── docs/CONTRACTS.md                       <- FROZEN, read this first
```

## Commands

| Command | Does |
|---|---|
| `npm run dev` | API with reload |
| `npm run client:dev` | Vite dev server (proxies `/api` to :4000) |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma — **B only** for migrate |
| `npm run chain:node` / `chain:test` / `chain:deploy:local` | Hardhat |
| `npm run attack:suite` | A's 8 attacks → `test/metrics.json` |
| `npm run test:smoke` | Payload codec, BK-tree, AES, confidence bands. Needs nothing installed — run it first when something looks broken. |

---

## Integration checkpoints — the whole team stops for 15 minutes

| Hour | Checkpoint | Pass criteria |
|---|---|---|
| **H2** | Contracts frozen | `docs/CONTRACTS.md` merged, all three agree |
| **H8** | **GO / NO-GO** | A: 46+/48 bits survive JPEG q75 · B: mocks live · C: two screens built |
| **H14** | Chain alive | Real Sepolia txHash exists, C renders an Etherscan link |
| **H20** | **FIRST FULL LOOP** | Upload → Decrypt → download → re-upload → verdict. Ugly is fine. |
| **H28** | Feature freeze | No mocks, no fallbacks. New features banned. |
| **H33** | Demo freeze | Video recorded, deck done, two rehearsals |

## The four mistakes that kill SIH teams

1. **Downloading packages at the venue.** Wi-Fi will not work. Zip `node_modules`
   onto a pendrive.
2. **No Sepolia test ETH.** Get it a week early.
3. **`sharp` install failing.** Test on all three laptops at home. Jimp is the
   pure-JS backup path.
4. **Starting integration at Hour 30.** Start at Hour 8 with mocks.

---

## Git rules

- Branches `feat/core-a`, `feat/backend-b`, `feat/client-c`. Merge to `main`
  **only at the integration checkpoints**.
- Commit every 30–45 minutes. `git stash` is not a backup strategy.
- `.env` is gitignored. `.env.example` lists every key.
