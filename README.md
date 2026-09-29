<div align="center">

<img src="docs/readme/hero.svg" alt="Decryption Provenance — every release watermarked and anchored on chain" width="100%"/>

<br/>

<a href="https://github.com/hayan9104/Crypto-2">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=18&duration=2600&pause=900&color=CC91F0&center=true&vCenter=true&width=720&lines=Decrypt+%E2%86%92+anchor+on+chain+%E2%86%92+watermark+%E2%86%92+release;A+leaked+copy+leads+back+to+its+receipt;Three+verdict+bands.+Never+a+guessed+name.;Post-quantum+signatures+on+every+receipt" alt="Typing animation"/>
</a>

<br/><br/>

<img src="https://img.shields.io/badge/SIH-26237-cc91f0?style=for-the-badge&labelColor=1f1a23" alt="SIH26237"/>
<img src="https://img.shields.io/badge/node-%E2%89%A5%2020-93f091?style=for-the-badge&logo=node.js&logoColor=white&labelColor=1f1a23" alt="Node 20+"/>
<img src="https://img.shields.io/badge/PostgreSQL-16-cc91f0?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=1f1a23" alt="PostgreSQL 16"/>
<img src="https://img.shields.io/badge/Solidity-0.8.24-ffb0c2?style=for-the-badge&logo=solidity&logoColor=white&labelColor=1f1a23" alt="Solidity 0.8.24"/>
<img src="https://img.shields.io/badge/PQC-ML--KEM%20%C2%B7%20ML--DSA-ffb500?style=for-the-badge&labelColor=1f1a23" alt="Post-quantum"/>
<img src="https://img.shields.io/badge/attack%20suite-8%2F8-93f091?style=for-the-badge&labelColor=1f1a23" alt="Attack suite 8/8"/>
<img src="https://img.shields.io/badge/license-MIT-fff8f8?style=for-the-badge&labelColor=1f1a23" alt="MIT"/>

<br/>

<img src="https://github.com/hayan9104/Crypto-2/actions/workflows/ci.yml/badge.svg" alt="CI"/>

<br/><br/>

**Tracing the source of a leaked classified document —<br/>without ever accusing anyone the evidence does not support.**

[How it works](#-how-it-works) ·
[Architecture](#-architecture) ·
[Flows](#-flows) ·
[Robustness](#-robustness) ·
[Tech stack](#-tech-stack) ·
[Setup](#-setup) ·
[API](#-api)

</div>

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ✦ The idea

When a protected file is decrypted, the system does two things before the
plaintext is released: it writes an **immutable receipt to a blockchain**, and it
embeds an **invisible, per-recipient watermark** into the copy that is handed
over. If that copy later leaks — compressed, resized, cropped, or photographed
off a screen — the mark can still be recovered and matched back to the receipt.

Built for SIH problem statement **SIH26237**. Node.js + React + PostgreSQL,
**CPU only**: no GPU, no model, no training data.

<table>
<tr>
<td width="33%" valign="top">

### 🔏 Mark every copy

A 48-bit payload is hidden in the frequency domain of each released copy
(2-level Haar DWT + QIM), protected by Reed-Solomon and a CRC-8.

</td>
<td width="33%" valign="top">

### ⛓️ Anchor every release

The receipt is written on chain **before** the mark is embedded.
No receipt, no copy — a marked file cannot exist without its record.

</td>
<td width="33%" valign="top">

### ⚖️ Refuse to guess

Verdicts come in three bands with plain-English reasons. Below 60%
the API returns `match: null` — the UI never receives a name it may not show.

</td>
</tr>
</table>

<div align="center">
<img src="docs/readme/pipeline.svg" alt="Release and trace pipeline" width="100%"/>
</div>

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ◈ How it works

**Release.** Decrypt (AES-256-GCM) → hash the exact bytes → derive a receipt id
→ anchor `{receiptId, assetRef, userRef, contentSha, payloadCommit}` on chain →
embed the 48-bit payload with a 2-level Haar DWT and QIM in the HL/LH sub-bands
→ index the perceptual hashes → record the event.

> [!IMPORTANT]
> The chain write happens **before** the watermark is embedded. If it fails, no
> marked file is ever released, so a marked copy cannot exist without a receipt.

**Trace.** Hash the leaked file → search the BK-tree index → extract the
watermark → look up the receipt → verify it on chain → score.

Two independent paths converge: the **watermark** identifies _which receipt_
(exact, but fragile under heavy attack) and the **perceptual hashes** identify
_which file_ (fuzzy, but survives a screenshot). Agreement earns confidence;
disagreement lowers it.

### The verdict is a band, never a name on its own

| Band              |      Score      | Meaning                     |
| :---------------- | :-------------: | :-------------------------- |
| 🟢 `ATTRIBUTED`   |   **≥ 0.85**    | Report the match            |
| 🟡 `PROBABLE`     | **0.60 – 0.85** | A lead, not a conclusion    |
| ⚪ `INCONCLUSIVE` |   **< 0.60**    | Report that it is not known |

Every verdict carries `reasons[]` in plain sentences — _"46/48 watermark bits
recovered (2 fixed by Reed-Solomon)"_, not _"bitConfidence=0.958"_. A score that
cannot be reviewed is not evidence.

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ⬡ Architecture

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf','secondaryColor':'#fff1d6','tertiaryColor':'#fff8f8','clusterBkg':'#fff8f8','clusterBorder':'#cc91f0'}}}%%
flowchart LR
    subgraph C["🖥️ Client · React + Vite + Tailwind"]
        direction TB
        UI["Role-gated screens<br/>Assets · Decrypt · Inspect · Trace<br/>Timeline · Robustness · History · Enroll"]
        BPQC["Browser PQC<br/>ML-DSA-65 signing<br/>scrypt + WebCrypto"]
    end

    subgraph S["⚙️ API · Express (Node 20)"]
        direction TB
        MW["Middleware<br/>session · role guard · Zod · uploads"]
        R["Routes<br/>auth · assets · decrypt · trace<br/>audit · metrics · users · keys · health"]
        subgraph CORE["server/core"]
            direction TB
            WM["watermark.js<br/>Haar DWT + QIM"]
            ECC["ecc.js · payload.js<br/>RS(12,6) + CRC-8"]
            PH["phash.js · bktree.js<br/>pHash · dHash · aHash"]
            CR["crypto.js · pqc.js<br/>AES-256-GCM · ML-KEM · ML-DSA"]
            CF["confidence.js<br/>score → band → reasons"]
            PDF["pdf.js · dossier.js<br/>PDF marks · evidence dossier"]
        end
    end

    DB[("🐘 PostgreSQL 16<br/>Prisma ORM")]
    FS[["🗄️ Cipher + marked<br/>file store"]]
    CH{{"⛓️ DecryptionProvenance.sol<br/>Hardhat local · Sepolia"}}

    UI -- "httpOnly cookie · /api" --> MW --> R
    BPQC -. "signature only" .-> R
    R --> CORE
    R <--> DB
    R <--> FS
    R -- "ethers v6" --> CH

    classDef chain fill:#1f1a23,stroke:#cc91f0,color:#fff8f8
    classDef store fill:#e4fbe3,stroke:#4fcd4c,color:#1f1a23
    class CH chain
    class DB,FS store
```

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ⟿ Flows

### 1 · Release a copy (`POST /api/decrypt`)

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','actorBkg':'#f6ecfd','actorBorder':'#9e5ecf','actorTextColor':'#1f1a23','signalColor':'#9e5ecf','signalTextColor':'#1f1a23','noteBkgColor':'#fff1d6','noteBorderColor':'#ff9100','activationBkgColor':'#e9d2fa','activationBorderColor':'#9e5ecf','sequenceNumberColor':'#fff8f8'}}}%%
sequenceDiagram
    autonumber
    actor O as Officer
    participant B as Browser
    participant A as API
    participant D as PostgreSQL
    participant K as Chain
    participant W as Watermark core

    O->>B: Pick document + allotted passphrase
    B->>A: POST /decrypt/challenge
    A-->>B: challenge
    B->>B: Unlock PQC bundle locally, sign with ML-DSA-65
    B->>A: POST /decrypt { assetId, passphrase, signature }
    activate A
    A->>D: Load asset, user, key encapsulation
    A->>A: Check role (officer → self only) + passphrase
    A->>A: ML-KEM decapsulate → AES-256-GCM decrypt
    A->>A: contentSha, receiptId, 48-bit payload
    A->>K: logDecryption(receiptId, assetRef, userRef,<br/>contentSha, payloadCommit, signatureCommit)
    alt chain write fails
        K-->>A: revert / unreachable
        A-->>B: CHAIN_ERROR — nothing released
    else anchored
        K-->>A: txHash, blockNumber
        A->>W: embed(payload) — DWT + QIM (or PDF layers)
        W-->>A: marked copy + PSNR
        A->>D: INSERT DecryptionEvent + hashes
        A->>A: Add to BK-tree index
        A-->>B: receipt + download link
    end
    deactivate A
    Note over A,K: The chain write precedes the mark.<br/>No receipt ⇒ no copy.
```

### 2 · Trace a leak (`POST /api/trace`)

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
flowchart TD
    L(["📄 Leaked file<br/>jpeg · crop · resize · screenshot"]) --> H["Perceptual hashes<br/>pHash · dHash · aHash"]
    L --> X["Extract 48 bits<br/>DWT + QIM · PDF layers"]

    H --> BK["BK-tree OR-vote<br/>Hamming ≤ threshold"]
    X --> RS{"RS + CRC-8<br/>valid?"}

    RS -- yes --> SID["shortId → DecryptionEvent<br/>O(1) unique index"]
    RS -- no --> CAND["Candidate search<br/>best bit agreement ≥ 30/48"]
    BK --> CAND
    SID --> CMP
    CAND --> CMP["Compare against embedded bits<br/>+ hash distances"]

    CMP --> CHN["getReceipt() on chain<br/>never throws — offline lowers score"]
    CHN --> SIG["Verify ML-DSA-65 signature"]
    SIG --> SC["confidence.js<br/>weighted score"]

    SC --> V{"score"}
    V -- "≥ 0.85" --> AT["🟢 ATTRIBUTED<br/>name + reasons"]
    V -- "0.60 – 0.85" --> PR["🟡 PROBABLE<br/>lead + reasons"]
    V -- "< 0.60" --> IN["⚪ INCONCLUSIVE<br/>match: null"]

    AT --> DOS["📑 Evidence dossier PDF"]
    PR --> DOS

    classDef ok fill:#e4fbe3,stroke:#4fcd4c,color:#1f1a23
    classDef mid fill:#fff1d6,stroke:#ff9100,color:#1f1a23
    classDef no fill:#f2ecf9,stroke:#6e6472,color:#1f1a23
    classDef src fill:#1f1a23,stroke:#cc91f0,color:#fff8f8
    class AT ok
    class PR mid
    class IN no
    class L src
```

### 3 · The verdict lifecycle

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
stateDiagram-v2
    direction LR
    [*] --> Uploaded: POST /trace
    Uploaded --> Hashed
    Hashed --> Extracted
    Extracted --> Matched: CRC ok
    Extracted --> Searched: CRC fails
    Searched --> Matched: candidate found
    Searched --> Scored: no candidate
    Matched --> ChainChecked
    ChainChecked --> Scored
    Scored --> ATTRIBUTED: ≥ 0.85
    Scored --> PROBABLE: ≥ 0.60
    Scored --> INCONCLUSIVE: < 0.60
    ATTRIBUTED --> [*]
    PROBABLE --> [*]
    INCONCLUSIVE --> [*]
```

### 4 · The 48-bit payload

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'JetBrains Mono, Consolas, monospace'}}}%%
packet-beta
0-35: "shortId — first 36 bits of receiptId (2³⁶ receipts)"
36-43: "CRC-8 (poly 0x07)"
44-47: "version / delta tag"
```

`48 bits → Reed-Solomon (12, 6) → 96 bits → spread with redundancy across keyed,
HMAC-permuted DWT coefficients.` The `shortId → receiptId` mapping is stored in
`DecryptionEvent.shortId`, so the full 32-byte receipt is always recoverable.

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ◐ Scoring

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','pie1':'#9e5ecf','pie2':'#cc91f0','pie3':'#ffb0c2','pie4':'#ffb500','pie5':'#93f091','pieStrokeColor':'#fff8f8','pieOuterStrokeColor':'#1f1a23','pieTitleTextSize':'18px','pieSectionTextColor':'#1f1a23'}}}%%
pie showData
    title Confidence weights (standard path)
    "Watermark bit agreement" : 45
    "pHash similarity" : 25
    "dHash similarity" : 15
    "aHash similarity" : 10
    "Chain verified" : 5
```

```text
score = 0.45 · bitAgreement
      + 0.25 · (1 − pHashDist / 64)
      + 0.15 · (1 − dHashDist / 64)
      + 0.10 · (1 − aHashDist / 64)
      + 0.05 · chainVerified
```

> [!NOTE]
> **Screenshot path.** When both pHash and dHash distances exceed 28 (a phone
> bezel or window frame has swamped the image) but ≥ 31/48 watermark bits still
> agree, the frequency-domain mark becomes the primary witness:
> `0.72 · bits + 0.13 · best-hash + 0.15 · chain`.

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ▲ Robustness

Measured by `npm run attack:suite` → [`test/metrics.json`](test/metrics.json).
Every attack clears its target; the marked image stays at **48.07 dB PSNR**
(visually indistinguishable) at the default `δ = 12`.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','xyChart':{'backgroundColor':'#fff8f8','titleColor':'#1f1a23','xAxisLabelColor':'#6e6472','yAxisLabelColor':'#6e6472','xAxisLineColor':'#e7dde0','yAxisLineColor':'#e7dde0','plotColorPalette':'#cc91f0, #ff87a6'}}}}%%
xychart-beta
    title "Watermark bits recovered (bars) vs. pass target (line), out of 48"
    x-axis ["JPEG q90", "JPEG q75", "JPEG q60", "JPEG q45", "Resize 50%", "Crop 20%", "Noise", "Screenshot"]
    y-axis "bits" 30 --> 48
    bar [48, 48, 48, 48, 43, 43, 43, 43]
    line [48, 46, 44, 41, 43, 40, 42, 40]
```

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','xyChart':{'backgroundColor':'#fff8f8','titleColor':'#1f1a23','xAxisLabelColor':'#6e6472','yAxisLabelColor':'#6e6472','plotColorPalette':'#9e5ecf'}}}}%%
xychart-beta
    title "Invisibility vs. strength — PSNR (dB) by QIM step δ"
    x-axis "delta (δ)" [4, 8, 12, 16, 24]
    y-axis "PSNR dB" 40 --> 60
    line [57.6, 51.6, 48.1, 45.6, 42.0]
```

| Attack                | Bits recovered | Target | Result |
| :-------------------- | :------------: | :----: | :----: |
| JPEG q90              |    48 / 48     |   48   |   ✅   |
| JPEG q75              |    48 / 48     |   46   |   ✅   |
| JPEG q60              |    48 / 48     |   44   |   ✅   |
| JPEG q45              |    48 / 48     |   41   |   ✅   |
| Resize 50%            |    43 / 48     |   43   |   ✅   |
| Crop 20%              |    43 / 48     |   40   |   ✅   |
| Gaussian noise        |    43 / 48     |   42   |   ✅   |
| Screenshot simulation |    43 / 48     |   40   |   ✅   |

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ◉ Privacy

No personal data reaches the blockchain. The only identity on chain is
`keccak256(userId || salt)`; names, departments and devices live in PostgreSQL
and never leave it.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf','clusterBkg':'#fff8f8'}}}%%
flowchart LR
    subgraph OFF["🔒 Off chain · PostgreSQL (private)"]
        N["names · departments · devices"]
        I["perceptual hash index · PSNR · δ"]
        E["encrypted blobs · investigations · txHash"]
    end
    subgraph ON["🌐 On chain (public, immutable)"]
        R["receiptId · assetRef · userRef"]
        C["contentSha · payloadCommit · signatureCommit"]
        T["block timestamp"]
    end
    N -- "keccak256(id ‖ salt)" --> R
    classDef pub fill:#1f1a23,stroke:#cc91f0,color:#fff8f8
    class R,C,T pub
```

`payloadCommit` is written at decryption time, so the block timestamp proves the
watermark **predates** any leak rather than being constructed after one.

<details>
<summary><b>🗃️ Data model (ER diagram)</b></summary>

<br/>

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
erDiagram
    USER ||--o{ DECRYPTION_EVENT : "receives"
    ASSET ||--o{ DECRYPTION_EVENT : "released as"
    USER ||--o{ ASSET_KEY_ENCAPSULATION : "holds"
    ASSET ||--o{ ASSET_KEY_ENCAPSULATION : "wrapped for"
    DECRYPTION_EVENT |o--o{ INVESTIGATION : "top match of"

    USER {
        int id PK
        string name "Postgres only"
        bytes userRef UK "keccak256(id||salt)"
        enum role "ADMIN | OFFICER | INVESTIGATOR"
        string passwordHash "scrypt"
        bytes kemPublicKey "ML-KEM-768"
        bytes dsaPublicKey "ML-DSA-65"
    }
    ASSET {
        int id PK
        string title
        string classification
        string cipherPath "AES-256-GCM blob"
        bytes originalSha
        bytes assetRef UK
    }
    ASSET_KEY_ENCAPSULATION {
        int id PK
        bytes kemCiphertext
        bytes encryptedKey
        string allottedPassphrase
    }
    DECRYPTION_EVENT {
        int id PK
        bytes receiptId UK
        bigint shortId UK "36 bits in the mark"
        bytes contentSha
        bigint pHash
        bigint dHash
        bigint aHash
        bytes txHash
        bytes decryptionSignature
        float psnrDb
    }
    INVESTIGATION {
        int id PK
        bytes uploadedSha
        bytes topReceiptId
        float confidence
        string verdict
        string_array reasons
    }
```

</details>

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ◇ Roles

Sign-in is required for everything except `/api/health`. The split is the same
separation-of-duties argument the verdict bands rest on.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
flowchart LR
    AD(["👑 ADMIN<br/>Registry Administrator"])
    OF(["🪪 OFFICER<br/>Clearance Holder"])
    IV(["🔎 INVESTIGATOR<br/>Forensic Analyst"])

    UP["Upload + encrypt"]
    DA["Decrypt for anyone"]
    DS["Decrypt for self"]
    TR["Trace a leak"]
    AU["Full audit trail"]

    AD --> UP & DA & DS & TR & AU
    OF --> DS
    IV --> TR & AU

    OF -. "✗ cannot trace<br/>(no one investigates their own leak)" .-x TR
    IV -. "✗ cannot decrypt<br/>(cannot manufacture a leak)" .-x DS

    classDef admin fill:#1f1a23,stroke:#cc91f0,color:#fff8f8
    classDef off fill:#e4fbe3,stroke:#4fcd4c,color:#1f1a23
    classDef inv fill:#fff1d6,stroke:#ff9100,color:#1f1a23
    class AD admin
    class OF off
    class IV inv
```

| Role           | Lands on   | Documents    | Decrypt       | Trace | Timeline   | Robustness |
| :------------- | :--------- | :----------- | :------------ | :---: | :--------- | :--------: |
| `ADMIN`        | `/assets`  | view, upload | anyone        |  ✅   | everyone's |     ✅     |
| `OFFICER`      | `/decrypt` | view         | **self only** |  ❌   | own only   |     ✅     |
| `INVESTIGATOR` | `/trace`   | view         | ❌            |  ✅   | everyone's |     ✅     |

[`server/lib/permissions.js`](server/lib/permissions.js) is the only place this
table lives. The API enforces it; the frontend reads the same capability list off
`/api/auth/me` and hides what it cannot do. **Hiding a button is a courtesy — the
refusal is the control.**

<details>
<summary><b>🔑 Seeded demo accounts</b></summary>

<br/>

`npm run db:seed` prints these:

| Role           | Email                                                        | Password     |
| :------------- | :----------------------------------------------------------- | :----------- |
| `ADMIN`        | `admin@example.gov`                                          | `admin123`   |
| `OFFICER`      | `u017@example.gov` · `u023@example.gov` · `u041@example.gov` | `officer123` |
| `INVESTIGATOR` | `a004@example.gov`                                           | `analyst123` |

Sessions are an httpOnly, SameSite=Lax cookie holding an HMAC-signed token
(`AUTH_SECRET`, 12 h by default). Passwords are scrypt. Both are built on
`node:crypto` — no bcrypt, no jsonwebtoken.

</details>

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ⚛ Post-quantum layer

| Purpose                                   | Algorithm                 | Standard      | Where                                          |
| :---------------------------------------- | :------------------------ | :------------ | :--------------------------------------------- |
| Per-recipient content-key wrap            | **ML-KEM-768** (Kyber)    | NIST FIPS 203 | `server/core/pqc.js`                           |
| Non-repudiation signature on each release | **ML-DSA-65** (Dilithium) | NIST FIPS 204 | `client/src/lib/pqc.js` → `server/core/pqc.js` |
| Private key bundle at rest                | AES-256-GCM + scrypt      | —             | unlocked **in the browser only**               |

The officer's private key never leaves the browser. Only the 3,309-byte ML-DSA-65
signature is sent to the server, and its `keccak256` commitment is anchored on
chain next to the receipt. Built on `@noble/post-quantum` — pure JS, works
air-gapped.

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ⚒ Tech stack

<div align="center">

<img src="https://skillicons.dev/icons?i=nodejs,express,react,vite,tailwind,postgres,prisma,solidity,ethereum,docker,githubactions,vercel&theme=dark&perline=12" alt="Tech stack icons"/>

</div>

<br/>

| Layer        | Tools                                                                                                                     |
| :----------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Frontend** | React 18 · Vite 5 · Tailwind CSS 3 · React Router 6 · TanStack Query · Recharts · Axios · wagmi / viem                    |
| **Backend**  | Node.js 20 · Express 4 · Zod · Multer · Nodemon                                                                           |
| **Imaging**  | sharp · Jimp · sharp-phash · pdf-lib — custom Haar DWT, QIM, pHash/dHash/aHash, BK-tree                                   |
| **Crypto**   | `node:crypto` (AES-256-GCM, SHA-256, scrypt, HMAC) · `@noble/post-quantum` (ML-KEM-768, ML-DSA-65) · pure-JS Reed-Solomon |
| **Data**     | PostgreSQL 16 · Prisma 5                                                                                                  |
| **Chain**    | Solidity 0.8.24 · OpenZeppelin AccessControl · Hardhat · ethers v6 · Sepolia                                              |
| **Quality**  | ESLint 9 · Prettier · Hardhat + Chai tests · GitHub Actions CI                                                            |
| **Design**   | Chromia identity tokens · Fraunces · Inter · Sniglet · JetBrains Mono                                                     |

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
mindmap
  root((Decryption<br/>Provenance))
    Watermark
      Haar DWT 2-level
      QIM in HL / LH
      Reed-Solomon 12,6
      CRC-8
      PDF metadata + raster tile
    Matching
      pHash
      dHash
      aHash
      BK-tree
    Crypto
      AES-256-GCM
      ML-KEM-768
      ML-DSA-65
      scrypt
    Chain
      Solidity receipts
      AccessControl LOGGER_ROLE
      Hardhat / Sepolia
    Evidence
      3 verdict bands
      Plain-English reasons
      Dossier PDF
```

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ⚡ Setup

> **Requires** Node 20+, PostgreSQL 16, and npm.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
flowchart LR
    A["1 · Clone<br/>+ npm run setup"] --> B["2 · .env"] --> C["3 · Postgres<br/>migrate + seed"] --> D["4 · Chain node<br/>+ deploy"] --> E["5 · API + UI"]
```

**1 · Clone and install**

```bash
git clone https://github.com/hayan9104/Crypto-2.git
cd Crypto-2
npm run setup                 # root + client deps, generates Prisma client
```

**2 · Environment** — create `.env` in the repo root (it is git-ignored).

<details>
<summary><b>Environment variables</b></summary>

<br/>

| Key                                                                                          | Purpose                                    |
| :------------------------------------------------------------------------------------------- | :----------------------------------------- |
| `PORT` · `NODE_ENV` · `CORS_ORIGIN`                                                          | API server                                 |
| `DATABASE_URL`                                                                               | PostgreSQL connection string               |
| `MASTER_KEY_HEX`                                                                             | 32-byte hex key for AES-256-GCM            |
| `REF_SALT`                                                                                   | salt for `assetRef` / `userRef` hashing    |
| `AUTH_SECRET` · `SESSION_TTL_HOURS`                                                          | session token signing and lifetime         |
| `WATERMARK_DELTA` · `WATERMARK_SEED`                                                         | QIM step and keyed coefficient permutation |
| `CHAIN_MODE`                                                                                 | `local` · `sepolia` · `off`                |
| `LOCAL_RPC_URL` · `LOCAL_CONTRACT_ADDRESS` · `LOCAL_PRIVATE_KEY`                             | Hardhat node                               |
| `SEPOLIA_RPC_URL` · `SEPOLIA_CONTRACT_ADDRESS` · `SEPOLIA_PRIVATE_KEY` · `ETHERSCAN_API_KEY` | testnet                                    |
| `CIPHER_DIR` · `MARKED_DIR` · `MAX_UPLOAD_MB`                                                | file storage                               |
| `BKTREE_MAX_DIST`                                                                            | Hamming radius for candidate search        |

</details>

**3 · Database**

```bash
docker run --name sih-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
npm run db:migrate
npm run db:seed               # demo accounts + encrypted documents
```

**4 · Contract**

```bash
npm run chain:node            # terminal 1, leave running
npm run chain:deploy:local    # terminal 2, prints the address
# put the printed address in .env as LOCAL_CONTRACT_ADDRESS
```

`CHAIN_MODE` selects `local`, `sepolia` or `off`. Sepolia gives a publicly
verifiable Etherscan link; fund the wallet from a faucet well in advance.

**5 · Run**

```bash
npm run dev                   # API  → http://localhost:4000
npm run client:dev            # UI   → http://localhost:5173
```

Sign in with `admin@example.gov` / `admin123` to reach every screen.
`GET /api/health` reports database, chain and index status, and lists anything
degraded in `warnings`.

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ⇄ API

Base path `/api`. Every failure returns `{ "error": { "code", "message" } }`.

<details open>
<summary><b>Endpoints</b></summary>

<br/>

| Method | Route                                   | Purpose                                                           | Who                       |
| :----- | :-------------------------------------- | :---------------------------------------------------------------- | :------------------------ |
| `GET`  | `/health`                               | Database, chain and index status                                  | anyone                    |
| `POST` | `/auth/login`                           | Sign in, sets an httpOnly session cookie                          | anyone                    |
| `POST` | `/auth/logout`                          | Clear the session                                                 | anyone                    |
| `GET`  | `/auth/me`                              | The current session and its capabilities                          | signed in                 |
| `GET`  | `/assets`                               | List protected documents                                          | signed in                 |
| `POST` | `/assets`                               | Upload and encrypt (multipart: `file`, `title`, `classification`) | admin                     |
| `GET`  | `/assets/:id`                           | One document, with its refs                                       | signed in                 |
| `GET`  | `/users`                                | Officers, with their hashed `userRef`                             | all; an officer gets self |
| `POST` | `/decrypt/challenge`                    | Nonce for the ML-DSA-65 release signature                         | admin, officer            |
| `POST` | `/decrypt`                              | Release a watermarked copy and anchor the receipt                 | admin; officer for self   |
| `POST` | `/decrypt/batch`                        | Allot passphrases and release to several officers                 | admin                     |
| `GET`  | `/decrypt/allotments/:assetId`          | Passphrase allotments for a document                              | admin, officer            |
| `POST` | `/decrypt/allotments/:assetId/reveal`   | Reveal your allotted passphrase (password re-check)               | admin, officer            |
| `GET`  | `/decrypt/releases/:assetId`            | Released copies of a document                                     | admin                     |
| `POST` | `/decrypt/inspect/:receiptId`           | Re-extract the mark from a released copy                          | admin                     |
| `POST` | `/trace`                                | Attribute a leaked file (multipart: `file`)                       | admin, investigator       |
| `GET`  | `/trace/investigations`                 | Recent investigations                                             | admin, investigator       |
| `GET`  | `/trace/:id/dossier`                    | Evidence dossier PDF for an investigation                         | admin, investigator       |
| `GET`  | `/audit/global`                         | Access timeline across every document                             | admin, investigator       |
| `GET`  | `/audit/:assetId`                       | Per-document access timeline                                      | all; officer gets own     |
| `GET`  | `/keys/public/:userId` · `/keys/bundle` | PQC public keys · your encrypted key bundle                       | signed in                 |
| `POST` | `/keys/generate`                        | Enrol: generate an ML-KEM + ML-DSA key pair                       | signed in                 |
| `GET`  | `/metrics`                              | Watermark robustness measurements                                 | signed in                 |
| `GET`  | `/files/marked/:receiptId`              | Download a released copy                                          | admin, or the recipient   |

**Error codes:** `BAD_INPUT` · `UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` ·
`PAYLOAD_TOO_LARGE` · `UNSUPPORTED_MEDIA` · `CHAIN_ERROR` · `CORE_NOT_READY` ·
`INTERNAL`

</details>

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ▤ Layout

```
contracts/          DecryptionProvenance.sol — role-gated receipt register
scripts/            deployment
prisma/             schema · migrations · seed
server/
  index.js          Express app and boot sequence
  routes/           auth · assets · decrypt · trace · audit · metrics · users · keys · health
  middleware/       Zod validation · uploads · session + role guards · error shape
  lib/              config · Prisma client · ref hashing · auth · permissions · errors
  core/
    watermark.js    Haar DWT + QIM embed / extract
    pdf.js          PDF metadata + rasterized DWT tile
    phash.js        pHash · dHash · aHash
    bktree.js       BK-tree over perceptual hashes
    crypto.js       AES-256-GCM · SHA-256 · MD5
    pqc.js          ML-KEM-768 · ML-DSA-65
    ecc.js          Reed-Solomon (12, 6)
    payload.js      48-bit payload codec + CRC-8
    psnr.js         quality measurement
    confidence.js   score → band → reasons
    chain.js        ethers v6 contract wrapper
    dossier.js      evidence dossier PDF
client/             React + Vite + Tailwind dashboard (login, role-gated routes)
test/               smoke test · attack suite · PQC end-to-end · contract tests
docs/               contracts · demo script · pitch deck · README assets
```

## ⌘ Commands

| Command                                                     | Purpose                                                   |
| :---------------------------------------------------------- | :-------------------------------------------------------- |
| `npm run dev`                                               | API with reload                                           |
| `npm run client:dev`                                        | Frontend dev server (proxies `/api`)                      |
| `npm run test:smoke`                                        | Payload codec and BK-tree — no install or database needed |
| `npm run attack:suite`                                      | Eight attacks against the watermark → `test/metrics.json` |
| `npm run chain:test`                                        | Contract tests                                            |
| `npm run db:migrate` · `db:seed` · `db:studio` · `db:reset` | Prisma                                                    |
| `npm run lint` · `npm run format`                           | ESLint, Prettier                                          |

### Continuous integration

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
flowchart LR
    P(["push / PR → main"]) --> B1 & C1
    subgraph backend
        B1["npm ci"] --> B2["format:check"] --> B3["lint"] --> B4["test:smoke"] --> B5["chain:compile"] --> B6["chain:test"]
    end
    subgraph client
        C1["npm ci"] --> C2["vite build"]
    end
```

<img src="docs/readme/divider.svg" width="100%" alt=""/>

## ✎ Contributing

Ownership is split three ways and each file header states its owner; do not edit
a file you do not own. Only one person runs `prisma migrate dev` — everyone else
runs `npx prisma migrate deploy && npx prisma generate`, so the migration history
stays linear.

## ⚖ License

MIT — see [LICENSE](LICENSE).

<div align="center">

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&height=120&section=footer&color=0:9e5ecf,50:cc91f0,100:ffb0c2&animation=twinkling" width="100%" alt=""/>

<sub>Built for Smart India Hackathon 2026 · SIH26237</sub>

</div>
