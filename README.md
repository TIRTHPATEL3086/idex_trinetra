<div align="center">

<img src="docs/readme/hero.svg" alt="Decryption Provenance" width="100%"/>

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=17&duration=2600&pause=900&color=CC91F0&center=true&vCenter=true&width=640&lines=Decrypt+%E2%86%92+anchor+on+chain+%E2%86%92+watermark;A+leaked+copy+leads+back+to+its+receipt;Three+verdict+bands.+Never+a+guessed+name." alt="Typing animation"/>

<br/>

<img src="https://img.shields.io/badge/node-%E2%89%A5%2020-93f091?style=for-the-badge&logo=node.js&logoColor=white&labelColor=1f1a23" alt="Node 20+"/>
<img src="https://img.shields.io/badge/PostgreSQL-16-cc91f0?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=1f1a23" alt="PostgreSQL 16"/>
<img src="https://img.shields.io/badge/Solidity-0.8.24-ffb0c2?style=for-the-badge&logo=solidity&logoColor=white&labelColor=1f1a23" alt="Solidity"/>
<img src="https://img.shields.io/badge/attacks-8%2F8-ffb500?style=for-the-badge&labelColor=1f1a23" alt="Attack suite 8/8"/>
<img src="https://github.com/hayan9104/Crypto-2/actions/workflows/ci.yml/badge.svg" alt="CI"/>

</div>

## ✦ What it does

When a protected file is decrypted, the system **anchors a receipt on a
blockchain**, then hides an **invisible, per-recipient watermark** in the copy.
If that copy leaks — compressed, cropped, or photographed off a screen — the mark
is recovered and matched back to its receipt. CPU only: no GPU, no model.

<img src="docs/readme/pipeline.svg" alt="Release and trace pipeline" width="100%"/>

| Band              |    Score    | Meaning                              |
| :---------------- | :---------: | :----------------------------------- |
| 🟢 `ATTRIBUTED`   |   ≥ 0.85    | Report the match                     |
| 🟡 `PROBABLE`     | 0.60 – 0.85 | A lead, not a conclusion             |
| ⚪ `INCONCLUSIVE` |   < 0.60    | `match: null` — no name is ever sent |

## ⬡ Architecture

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
flowchart LR
    UI["🖥️ React client<br/>role-gated screens"] -- "/api · cookie" --> API["⚙️ Express API"]
    API --> CORE["🔏 Core<br/>DWT + QIM watermark<br/>pHash · BK-tree<br/>AES-256-GCM · ML-KEM · ML-DSA"]
    API <--> DB[("🐘 PostgreSQL<br/>Prisma")]
    API -- "ethers v6" --> CH{{"⛓️ DecryptionProvenance.sol"}}
    classDef dark fill:#1f1a23,stroke:#cc91f0,color:#fff8f8
    class CH dark
```

## ⟿ Trace flow

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, sans-serif','primaryColor':'#f6ecfd','primaryBorderColor':'#9e5ecf','primaryTextColor':'#1f1a23','lineColor':'#9e5ecf'}}}%%
flowchart LR
    L(["📄 Leaked file"]) --> H["Perceptual hashes<br/>BK-tree search"]
    L --> X["Extract 48 bits<br/>RS + CRC-8"]
    H & X --> M["Match receipt"] --> C["Verify on chain<br/>+ ML-DSA signature"] --> S{"Score"}
    S -- "≥ 0.85" --> A["🟢 ATTRIBUTED"]
    S -- "≥ 0.60" --> P["🟡 PROBABLE"]
    S -- "< 0.60" --> I["⚪ INCONCLUSIVE"]
    classDef ok fill:#e4fbe3,stroke:#4fcd4c,color:#1f1a23
    classDef mid fill:#fff1d6,stroke:#ff9100,color:#1f1a23
    classDef src fill:#1f1a23,stroke:#cc91f0,color:#fff8f8
    class A ok
    class P mid
    class L src
```

## ▲ Robustness

```mermaid
%%{init: {'theme':'base','themeVariables':{'xyChart':{'backgroundColor':'#fff8f8','plotColorPalette':'#cc91f0, #ff87a6'}}}}%%
xychart-beta
    title "Watermark bits recovered (bars) vs. target (line), out of 48"
    x-axis ["JPEG q90", "JPEG q75", "JPEG q60", "JPEG q45", "Resize 50%", "Crop 20%", "Noise", "Screenshot"]
    y-axis "bits" 30 --> 48
    bar [48, 48, 48, 48, 43, 43, 43, 43]
    line [48, 46, 44, 41, 43, 40, 42, 40]
```

All 8 attacks pass at **48 dB PSNR** (visually identical) — `npm run attack:suite`.

## ◇ Roles

| Role           | Decrypt       | Trace | Why                                         |
| :------------- | :------------ | :---: | :------------------------------------------ |
| `ADMIN`        | anyone        |  ✅   | full custody                                |
| `OFFICER`      | **self only** |  ❌   | nobody investigates their own leak          |
| `INVESTIGATOR` | ❌            |  ✅   | cannot manufacture the leak they "discover" |

## ⚒ Tech stack

<div align="center">
<img src="https://skillicons.dev/icons?i=nodejs,express,react,vite,tailwind,postgres,prisma,solidity,ethereum,githubactions&theme=dark" alt="Tech stack"/>
</div>

<br/>

**Also:** Hardhat · ethers v6 · sharp · pdf-lib · Zod · `@noble/post-quantum`
(ML-KEM-768, ML-DSA-65) · TanStack Query · Recharts

## ⚡ Quick start

```bash
git clone https://github.com/hayan9104/Crypto-2.git && cd Crypto-2
npm run setup                                   # deps + Prisma client
# create .env — DATABASE_URL, MASTER_KEY_HEX, AUTH_SECRET, CHAIN_MODE, ...
docker run --name sih-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
npm run db:migrate && npm run db:seed
npm run chain:node                              # terminal 1
npm run chain:deploy:local                      # terminal 2 → LOCAL_CONTRACT_ADDRESS
npm run dev                                     # API → :4000
npm run client:dev                              # UI  → :5173
```

Sign in as `admin@example.gov` / `admin123`. More in [`docs/`](docs/).

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=100&section=footer&color=0:9e5ecf,50:cc91f0,100:ffb0c2" width="100%" alt=""/>

<sub>Smart India Hackathon 2026 · SIH26237 · MIT License</sub>

</div>
