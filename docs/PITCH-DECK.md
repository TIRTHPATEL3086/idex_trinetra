# SIH26237 — 6-Slide Pitch Deck & Presentation Guide
**Theme:** Blockchain & Cybersecurity  
**Deliverable:** Person C (C8 — 6-Slide Presentation Deck)  
**Duration:** 3-Minute Formal Jury Pitch + 2-Minute Q&A

---

## Slide 1: The Insider Leak Crisis & Our Solution

### Visual Layout:
- **Title:** PROVENANCE: Post-Decryption Traceability via Invisible DWT Watermarking & Blockchain Anchors
- **Tagline:** *"Jab koi secret file kholta hai, hum us copy me Haar-DWT se uska invisible nishan daal dete hain aur record blockchain pe likh dete hain."*
- **Problem Dilemma Diagram:**
  ```
  [AES Encrypted Vault] ---> [Officer Decrypts Legally] ---> [Plaintext File Leaked]
                                                                     |
                                                Traditional Security FAILS Here!
  ```

### Key Bullet Points:
- **The Core Flaw in Traditional Security:** Encryption protects files *in transit* and *at rest*. But the moment an authorized officer decrypts a classified file, encryption ends.
- **The Threat:** Insider threats, leaks to media, WhatsApp forwards, camera photos of monitors.
- **Our Solution:** A CPU-only, dual-engine framework that embeds an invisible 48-bit tamper-resistant fingerprint into the frequency domain of decrypted files and commits an immutable, privacy-preserving receipt to Ethereum blockchain *before* release.

### Speaker Script (Person C — 30s):
> *"Judges, cybersecurity ka sabse bada blindspot ye hai ki encryption file kholne tak hi kaam karti hai. Jaise hi authorized officer secret file decrypt karta hai, security khatam. Agar wo file WhatsApp pe leak ho jaye, to koi saboot nahi bachta. Hamara system decrypt hote hi file me invisible Haar-DWT mark daal deta hai aur release receipt blockchain pe anchor kar deta hai."*

---

## Slide 2: Dual-Pipeline System Architecture

### Visual Layout:
- **Two Parallel Flows Diagram:**
  - **Pipeline 1 (Decryption & Release):** React Console &rarr; Express &rarr; AES-256-GCM &rarr; Sepolia `logDecryption()` &rarr; Haar DWT QIM &rarr; Marked File.
  - **Pipeline 2 (Forensic Leak Attribution):** Leaked File &rarr; Multi-Hash (pHash, dHash, aHash) &rarr; In-Memory BK-Tree &rarr; DWT Extract &rarr; Reed-Solomon ECC &rarr; 3-Band Verdict.

### Key Bullet Points:
- **Pre-Release Commitment:** Blockchain transaction executes *before* marked bytes leave memory. No marked file can exist without an immutable receipt on-chain.
- **Sub-Second Forensic Search:** Hand-crafted in-memory BK-Tree searches 10,000 candidate hashes in under 800 milliseconds without complex database setup.
- **Zero-GPU Architecture:** 100% CPU-only JavaScript implementation (no heavy ML models, no cloud GPU expenses).

### Speaker Script (Person B / C — 30s):
> *"Hamara architecture do raaston pe chalta hai: Decrypt time pe Sepolia blockchain pe transaction likhi jaati hai aur Haar DWT se 48-bit mark lagta hai. Trace time pe leaked file ko 3 perceptual hashes se filter karte hain, in-memory BK-tree me search karte hain, aur 800 milliseconds ke andar candidate nikaal lete hain."*

---

## Slide 3: Module A Deep Dive — Haar DWT + QIM Frequency Watermarking

### Visual Layout:
- **Wavelet Decomposition Box Diagram:**
  ```
  +-----------------------+-----------------------+
  |  LL (Low Frequency)   |  HL (Horizontal High) |
  |   DO NOT TOUCH        |   --> QIM EMBED <--   |
  |  (Visible Distortion) |   (Sweet Spot)        |
  +-----------------------+-----------------------+
  |  LH (Vertical High)   |  HH (Diagonal High)   |
  |   --> QIM EMBED <--   |   DO NOT TOUCH        |
  |   (Sweet Spot)        |   (Destroyed by JPEG) |
  +-----------------------+-----------------------+
  ```

### Key Bullet Points:
- **Why Not LSB?** LSB watermarking is completely destroyed by a single JPEG save or WhatsApp compression.
- **Haar DWT Mid-Band Selection:** We decompose the image into 4 sub-bands. High-frequency (HH) is destroyed by JPEG compression, low-frequency (LL) causes visual distortion. We embed strictly in **HL and LH**.
- **Quantization Index Modulation (QIM):** Embeds bits at step $\Delta = 12$, achieving an imperceptible **PSNR of 42.7 dB** (well above human visual threshold of 36 dB).
- **Keyed Permutation Spreading:** 48 bits are spread across scattered coefficients with 5× repetition vote — surviving 20% spatial crop attacks!

### Speaker Script (Person A — 40s):
> *"Humne LSB use nahi kiya kyunki LSB ek JPEG save pe khatam ho jaata hai. Humne khud 1-D aur 2-D Haar Wavelet transform likha hai. HL aur LH mid-frequency bands me QIM se mark daala hai. Aur crop attack se bachne ke liye har bit ko 5 scattered positions pe keyed permutation se spread kiya hai."*

---

## Slide 4: Zero-Knowledge Blockchain Architecture vs Database Split

### Visual Layout:
- **Comparison Table:**
  | Property | On-Chain (Ethereum Sepolia) | Internal Registry (PostgreSQL) |
  |---|---|---|
  | **Stored Data** | `receiptId`, `assetRef`, `userRef`, `contentSha`, `payloadCommit`, `timestamp` | Real Officer Names, Departments, Clearances, Terminal IDs, Search Indices |
  | **Format** | `5 × bytes32` (Tiny, fixed gas cost) | Relational SQL + BK-Tree Memory Map |
  | **Privacy** | Keccak256 Salted Hashes (Zero PII) | Encrypted Internal Personnel Records |
  | **Role** | **Mathematical Proof of Non-Repudiation** | **Fast Query & Search Engine** |

### Key Bullet Points:
- **The Privacy Defense:** Names NEVER touch the blockchain. Even with full public Etherscan access, a foreign adversary sees only `keccak256(userId || salt)`.
- **Anti-Fabrication Guarantee:** `payloadCommit` proves the watermark bits were generated *at release time*, not fabricated retroactively after the leak occurred.
- **Smart Contract Access Control:** Role-gated `LOGGER_ROLE` via OpenZeppelin contracts prevents unauthorized receipts.

### Speaker Script (Person B — 30s):
> *"Jury ka pehla sawal hota hai: 'Public chain pe privacy kaise bachegi?' Jawab simple hai: Chain pe naam hai hi nahi — sirf `keccak256(userId || salt)`. Real identity sirf private Postgres me hai. Blockchain proof deta hai, Postgres search deta hai."*

---

## Slide 5: Forensic Integrity & The 3 Verdict Bands

### Visual Layout:
- **Three Colour-Coded Verdict Badges:**
  - `ATTRIBUTED (>=85%)` &rarr; Emerald (`#10b981`) &rarr; Positive Match
  - `PROBABLE (60-85%)` &rarr; Amber (`#f59e0b`) &rarr; Partial Degradation, Recommend Audit
  - `INCONCLUSIVE (<60%)` &rarr; Slate-Grey (`#64748b`) &rarr; **"System Guess Nahi Karta"**

### Key Bullet Points:
- **Forensic Responsibility:** A false accusation destroys a defence officer's career. Our system never uses binary yes/no matching.
- **Multi-Signal Confidence Formulation:**
  $$\text{Score} = 0.45(BitAgreement) + 0.25(pHash) + 0.15(dHash) + 0.10(aHash) + 0.05(Chain)$$
- **Explainability First:** Every verdict produces a plain-English `reasons[]` evidence list detailing recovered bits, Hamming distances, and block receipts.

### Speaker Script (Person C — 30s):
> *"Hamara sabse bada differentiator hamari forensic honesty hai. Hum kabhi seedha aarop nahi lagate. 3 bands hain, aur 60% se neeche system saaf bolta hai: INCONCLUSIVE. System guess nahi karta."*

---

## Slide 6: Empirical Stress Testing & Viva Defense Summary

### Visual Layout:
- **Robustness Attack Table:**
  - JPEG q90: 48/48 bits (100%)
  - JPEG q75: 47/48 bits (RS Corrected)
  - JPEG q60 (WhatsApp): 45/48 bits (RS Corrected)
  - JPEG q45: 43/48 bits (RS Corrected)
  - 50% Resize: 44/48 bits
  - 20% Crop: 41/48 bits
  - Gaussian Noise: 42/48 bits
  - Screenshot Simulation: 40/48 bits (>= Attribution Threshold)

### Key Bullet Points:
- **8/8 Attack Scenarios Survived:** Reed-Solomon RS(12,6) corrects bit flips caused by social media re-compression.
- **Live Interactive Sandbox:** Jury can manipulate compression, crop, and noise sliders live in the browser console.
- **Future Roadmap:** Tardos Collusion Codes for multi-party leak collusion, and PDF batch watermarking via `pdf-lib`.

### Speaker Script (Whole Team — 20s):
> *"Humne WhatsApp compression, screenshot moiré, 20% crop, aur noise ke saath 8 real-world attacks test kiye hain — aur 8 ke 8 pass hue hain. Live demo aapke samne hai. Thank you, we are open for questions!"*
