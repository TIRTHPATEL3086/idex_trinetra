<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:9e5ecf,50:cc91f0,100:ffb0c2&height=250&section=header&text=Decryption%20Provenance&fontSize=72&fontAlignY=38&desc=Forensic%20Leak%20Attribution%20for%20Classified%20Documents&descAlignY=60&descAlign=50&fontColor=fff8f8&animation=fadeIn" width="100%" alt="Header" />

<br/>

<a href="#-how-it-works">
  <img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=800&size=26&pause=1000&color=9E5ECF&center=true&vCenter=true&width=820&height=60&lines=INVISIBLE+PER-RECIPIENT+WATERMARKS;BLOCKCHAIN-ANCHORED+RELEASE+RECEIPTS;POST-QUANTUM+SIGNATURES;NEVER+A+GUESSED+NAME" alt="Typing SVG" />
</a>

<br/>

[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20Tailwind-cc91f0?style=for-the-badge&logo=react&logoColor=1f1a23)](https://react.dev/)
[![NodeJS](https://img.shields.io/badge/Backend-Node.js%2020%20%7C%20Express-9e5ecf?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016%20%7C%20Prisma-1f1a23?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Solidity](https://img.shields.io/badge/Blockchain-Solidity%20%7C%20Hardhat%20%7C%20ethers-ffb0c2?style=for-the-badge&logo=solidity&logoColor=1f1a23)](https://soliditylang.org/)
[![PQC](https://img.shields.io/badge/Post--Quantum-ML--KEM--768%20%7C%20ML--DSA--65-ffb500?style=for-the-badge&logo=letsencrypt&logoColor=1f1a23)](https://csrc.nist.gov/projects/post-quantum-cryptography)

<br/>

![GitHub Repo stars](https://img.shields.io/github/stars/hayan9104/Crypto-2?style=flat-square&color=9e5ecf)
![GitHub forks](https://img.shields.io/github/forks/hayan9104/Crypto-2?style=flat-square&color=cc91f0)
![GitHub last commit](https://img.shields.io/github/last-commit/hayan9104/Crypto-2?style=flat-square&color=ffb0c2)
![CI](https://img.shields.io/github/actions/workflow/status/hayan9104/Crypto-2/ci.yml?branch=main&style=flat-square&label=CI)
![License](https://img.shields.io/badge/license-MIT-1f1a23?style=flat-square)

<br/>

> **🔏 "A leaked document should lead back to the copy it came from — and never to a guess."**

[🏗️ **ARCHITECTURE**](#-system-architecture) &nbsp;•&nbsp; [📊 **ROBUSTNESS**](#-robustness) &nbsp;•&nbsp; [🚀 **QUICKSTART**](#-quickstart) &nbsp;•&nbsp; [📑 **DOCS**](docs/)

</div>

---

<br/>

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=9e5ecf&height=60&text=🏆%20WHY%20IT%20MATTERS&fontColor=fff8f8&fontSize=30" alt="USP Banner"/>
</div>

<br/>

When a classified document leaks, the usual question — _who leaked it?_ — tends to
end in suspicion rather than proof. **Decryption Provenance** (Smart India
Hackathon 2026, **SIH26237**) makes every release traceable, and refuses to name
anyone the evidence does not support:

- **⛓️ Receipt Before Release:** A receipt is written to a smart contract _before_ the plaintext leaves the system. If the chain write fails, no copy is released — a marked file can never exist without its record.
- **🔏 Invisible Per-Recipient Watermark:** A 48-bit payload is hidden in the frequency domain (2-level Haar DWT + QIM), protected by **Reed-Solomon (12,6)** and **CRC-8**, at **48 dB PSNR** — visually identical to the original.
- **🛡️ Survives Real Leaks:** Recovered after JPEG recompression, 50% resize, 20% crop, noise and screenshot capture — **8 / 8 attacks passed**.
- **⚖️ Never Guesses a Name:** Three verdict bands with plain-language reasons. Below 60% confidence the API returns `match: null` — the UI never receives a name it is not allowed to show.
- **⚛️ Post-Quantum Ready:** Content keys wrapped with **ML-KEM-768** (FIPS 203); every release signed in the browser with **ML-DSA-65** (FIPS 204), its commitment anchored on chain.
- **🕵️ Privacy by Design:** Only hashes reach the blockchain. Names, departments and devices stay in PostgreSQL.
- **📄 Images & PDFs:** PDFs carry a metadata mark plus a rasterized DWT tile on every page; each investigation exports an **evidence dossier PDF**.

<br/>

<div align="center">
  <img src="docs/readme/pipeline.svg" alt="Release and trace pipeline" width="100%"/>
</div>

<br/>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=1f1a23&height=60&text=🧠%20HOW%20IT%20WORKS&fontColor=cc91f0&fontSize=30" alt="How It Works Banner"/>
</div>

<br/>

A leaked file is examined along **two independent paths** — the watermark says
_which receipt_, the perceptual hashes say _which file_. Agreement earns
confidence; disagreement lowers it.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
graph TD
    A[📄 Leaked File Uploaded by Investigator] --> B[🔍 Perceptual Hashes: pHash · dHash · aHash]
    A --> C[🧬 Extract 48-bit Watermark: DWT + QIM]
    B --> D[🌳 BK-Tree Similarity Search]
    C --> E{Reed-Solomon + CRC-8 Valid?}
    E -->|Yes| F[🎯 Exact Receipt Lookup]
    E -->|No| D
    D --> F
    F --> G[⛓️ Verify Receipt On Chain + ML-DSA Signature]
    G --> H{Confidence Score}
    H -->|≥ 0.85| I[🟢 ATTRIBUTED: Recipient + Reasons]
    H -->|0.60 – 0.85| J[🟡 PROBABLE: Lead for Review]
    H -->|< 0.60| K[⚪ INCONCLUSIVE: match = null]
    I --> L[📑 Evidence Dossier PDF]
    J --> L
```

### 🔬 Core Engines

1. **🧬 Watermark Engine** (`watermark.js`): 2-level Haar DWT with QIM in the HL/LH sub-bands, HMAC-keyed coefficient permutation.
2. **🧱 Error Correction** (`ecc.js`, `payload.js`): Pure-JS Reed-Solomon (12,6) + CRC-8 over a 36-bit receipt id.
3. **🔍 Perceptual Matcher** (`phash.js`, `bktree.js`): pHash (2D-DCT), dHash, aHash with a BK-tree over Hamming distance.
4. **⚖️ Confidence Scorer** (`confidence.js`): 45% watermark bits · 25% pHash · 15% dHash · 10% aHash · 5% on-chain verification.
5. **⚛️ PQC Module** (`pqc.js`): ML-KEM-768 key encapsulation and ML-DSA-65 non-repudiation signatures.

<br/>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=9e5ecf&height=60&text=🏗️%20SYSTEM%20ARCHITECTURE&fontColor=fff8f8&fontSize=30" alt="Architecture Banner"/>
</div>

<br/>

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf','clusterBkg':'#fff8f8','clusterBorder':'#cc91f0'}}}%%
flowchart TB
    subgraph Client [Frontend Client - React 18 + Vite + Tailwind]
        AS[Assets & Upload]
        DC[Decrypt & Release]
        TR[Trace Investigation]
        TL[Timeline & Audit]
        RB[Robustness Metrics]
        BR[Browser PQC Signing]
    end

    subgraph Gateway [Auth & Access Control]
        AUTH[scrypt + HMAC Session Cookie]
        RBAC[Capability-based Role Guards]
    end

    subgraph Core [Express.js Core]
        REL[Release Pipeline]
        TRC[Trace Pipeline]
        WM[DWT + QIM Watermark]
        HS[Perceptual Hash + BK-Tree]
        CR[AES-256-GCM + ML-KEM + ML-DSA]
        SC[Confidence Scorer]
    end

    subgraph Data [Persistence]
        PG[(PostgreSQL 16 via Prisma)]
        FS[Encrypted & Marked File Store]
    end

    subgraph Chain [Blockchain]
        SOL[DecryptionProvenance.sol]
        NET[Hardhat Local / Sepolia]
    end

    Client --> Gateway --> Core
    Core <--> Data
    Core -->|ethers v6| Chain
```

### 🔄 Release Sequence

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','actorBkg':'#f6ecfd','actorBorder':'#9e5ecf','actorTextColor':'#1f1a23','signalColor':'#9e5ecf','signalTextColor':'#1f1a23','noteBkgColor':'#fff1d6','noteBorderColor':'#ff9100'}}}%%
sequenceDiagram
    autonumber
    actor O as Officer
    participant B as Browser
    participant A as API
    participant K as Blockchain
    O->>B: Select document + passphrase
    B->>B: Sign release with ML-DSA-65 (key never leaves browser)
    B->>A: POST /api/decrypt
    A->>A: ML-KEM unwrap → AES-256-GCM decrypt
    A->>K: logDecryption(receiptId, assetRef, userRef, contentSha, payloadCommit)
    alt Chain write fails
        A-->>B: CHAIN_ERROR — nothing released
    else Anchored
        A->>A: Embed 48-bit watermark
        A-->>B: Marked copy + receipt
    end
```

<br/>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=1f1a23&height=60&text=📊%20ROBUSTNESS&fontColor=ffb0c2&fontSize=30" alt="Robustness Banner"/>
</div>

<br/>

Measured with `npm run attack:suite` ([`test/metrics.json`](test/metrics.json)) at the default QIM step δ = 12.

```mermaid
%%{init: {'theme':'base','themeVariables':{'xyChart':{'backgroundColor':'#fff8f8','plotColorPalette':'#cc91f0, #1f1a23'}}}}%%
xychart-beta
    title "Watermark bits recovered (bars) vs. pass threshold (line), of 48"
    x-axis ["JPEG 90", "JPEG 75", "JPEG 60", "JPEG 45", "Resize 50%", "Crop 20%", "Noise", "Screenshot"]
    y-axis "Bits" 30 --> 48
    bar [48, 48, 48, 48, 43, 43, 43, 43]
    line [48, 46, 44, 41, 43, 40, 42, 40]
```

| Attack                         | Bits Recovered |     Threshold     | Result |
| :----------------------------- | :------------: | :---------------: | :----: |
| JPEG quality 90 / 75 / 60 / 45 |    48 / 48     | 48 / 46 / 44 / 41 |   ✅   |
| Resize 50%                     |    43 / 48     |        43         |   ✅   |
| Crop 20%                       |    43 / 48     |        40         |   ✅   |
| Gaussian noise                 |    43 / 48     |        42         |   ✅   |
| Screenshot simulation          |    43 / 48     |        40         |   ✅   |

<br/>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=9e5ecf&height=60&text=🔐%20SEPARATION%20OF%20DUTIES&fontColor=fff8f8&fontSize=30" alt="Security Banner"/>
</div>

<br/>

Each role is deliberately missing a power, so no single person can both create and investigate a leak:

| Role           | Label                      | Access Policy                                                                                                       |
| :------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `ADMIN`        | **Registry Administrator** | Uploads documents, releases copies to anyone, runs investigations, reads the full audit trail.                      |
| `OFFICER`      | **Clearance Holder**       | Releases a watermarked copy **to themselves only**. Cannot trace — nobody investigates their own leak.              |
| `INVESTIGATOR` | **Forensic Analyst**       | Traces leaked files and reads the audit trail. **Cannot decrypt** — so cannot manufacture the leak they "discover". |

> 🔒 _Permissions live in one file, [`server/lib/permissions.js`](server/lib/permissions.js). The API enforces them; the client only hides what a role cannot do. An officer calling `/api/trace` receives `403 FORBIDDEN`._

<br/>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=1f1a23&height=60&text=🧰%20TECH%20STACK&fontColor=cc91f0&fontSize=30" alt="Tech Stack Banner"/>
</div>

<br/>

<div align="center">
  <img src="https://skillicons.dev/icons?i=react,vite,tailwind,nodejs,express,postgres,prisma,solidity,ethereum,githubactions&theme=dark" alt="Tech stack"/>
</div>

<br/>

| Layer            | Technology                                                                  |
| :--------------- | :-------------------------------------------------------------------------- |
| **Frontend**     | React 18, Vite, Tailwind CSS, React Router, TanStack Query, Recharts        |
| **Backend**      | Node.js 20, Express, Zod, Multer                                            |
| **Imaging**      | sharp, Jimp, pdf-lib — custom Haar DWT, QIM, pHash / dHash / aHash, BK-tree |
| **Cryptography** | AES-256-GCM, scrypt, `@noble/post-quantum` (ML-KEM-768, ML-DSA-65)          |
| **Database**     | PostgreSQL 16, Prisma ORM                                                   |
| **Blockchain**   | Solidity 0.8.24, OpenZeppelin AccessControl, Hardhat, ethers v6, Sepolia    |

<br/>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=9e5ecf&height=60&text=📈%20ROADMAP&fontColor=fff8f8&fontSize=30" alt="Roadmap Banner"/>
</div>

<br/>

- [x] **Phase 1:** AES-256-GCM vault, DWT + QIM watermark, Reed-Solomon payload codec.
- [x] **Phase 2:** On-chain receipts, perceptual hash BK-tree, three-band confidence scoring.
- [x] **Phase 3:** Role-based access, post-quantum key wrap and signatures, PDF watermarking.
- [x] **Phase 4:** Evidence dossier export, Sepolia deployment, attack-suite benchmarks.
- [ ] **Phase 5:** Merkle-batched receipt anchoring (one transaction per batch).
- [ ] **Phase 6:** Full-page raster watermark extraction for printed-and-scanned PDFs.

<br/>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=1f1a23&height=60&text=🚀%20QUICKSTART&fontColor=ffb0c2&fontSize=30" alt="Quickstart Banner"/>
</div>

<br/>

### 1️⃣ Clone & Install

```bash
git clone https://github.com/hayan9104/Crypto-2.git
cd Crypto-2
npm run setup            # root + client deps, Prisma client
```

### 2️⃣ Configure

Create `.env` in the project root with at least `DATABASE_URL`, `MASTER_KEY_HEX`,
`REF_SALT`, `AUTH_SECRET`, `WATERMARK_SEED` and `CHAIN_MODE` (`local` · `sepolia` · `off`).

### 3️⃣ Database, Chain & Launch

```bash
docker run --name sih-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
npm run db:migrate
npm run db:seed          # demo accounts, one per role

npm run chain:node       # terminal 1 — local blockchain
npm run chain:deploy:local   # terminal 2 — copy address to LOCAL_CONTRACT_ADDRESS

npm run dev              # API → http://localhost:4000
npm run client:dev       # UI  → http://localhost:5173
```

Sign in as `admin@example.gov` / `admin123` to reach every screen.

### 4️⃣ Test

```bash
npm run test:smoke       # payload codec + BK-tree
npm run attack:suite     # watermark robustness benchmark
npm run chain:test       # smart contract tests
```

<br/>

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:ffb0c2,50:cc91f0,100:9e5ecf&height=150&section=footer&text=Built%20for%20Smart%20India%20Hackathon%202026&fontSize=28&fontAlignY=65&fontColor=fff8f8" width="100%" alt="Footer" />

_Decryption Provenance — SIH26237 · Released under the [MIT License](LICENSE)._ 🇮🇳

</div>
