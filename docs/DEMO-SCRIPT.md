# The 60-Second Demo

> Owner: **Person C**. Rehearse this exactly. Two full dry runs with the whole
> team at Hours 35–36, timed under 90 seconds.

| # | Action | Line to say | Owner |
|---|---|---|---|
| 1 | Click **Decrypt** on "Ops Order 44" as Officer U-017 | *"Officer file khol raha hai. Receipt abhi blockchain pe jaa rahi hai."* | C drives |
| 2 | Click the **Etherscan link** — live public transaction | *"Ye public Ethereum pe hai. Hum bhi ise mita nahi sakte."* | C |
| 3 | Show **before / after** side by side | *"Dono same dikh rahe hain na? PSNR 42.7 dB. Andar uska nishan hai."* | A explains |
| 4 | Run JPEG q60 + 50% resize on the marked file | *"Ab isko WhatsApp jaise kharab karte hain."* | C |
| 5 | Upload the damaged file to **Trace** | — | C |
| 6 | Verdict card appears | *"Officer U-017, 12 March 2026, 2:22 PM — **93% ATTRIBUTED**."* | B explains the chain cross-check |
| 7 | Upload a **random unrelated photo** | *"Aur agar system ko nahi pata — to wo saaf bolta hai: **INCONCLUSIVE**. Ye guess nahi karta."* | whole team |

> **Step 7 is the most important step in the entire demo.** It is what separates
> a team that understands forensic responsibility from a team that just built a
> matcher. Do not cut it for time.

---

## Before you present

- [ ] `/api/health` shows `coreFallback: []` — no stand-ins running
- [ ] `MOCK_MODE=false`
- [ ] The Etherscan link opens in a new tab and actually resolves
- [ ] A recorded backup video exists (**record it by Hour 33, not Hour 35**)
- [ ] `CHAIN_MODE` can be flipped to `local` in under 30 seconds if the RPC dies
- [ ] The random-photo file for step 7 is already on the desktop

---

## Viva question bank — each member owns their answers

| Question | Who | Answer |
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

## 6-slide deck outline

1. **The problem** — a classified file leaked. Who opened it? The register is
   held by the same department that might have leaked it.
2. **The idea** — mark the copy at the moment of decryption, anchor the receipt
   somewhere nobody (including us) can edit.
3. **How the mark survives** — Haar DWT, HL/LH sub-bands, QIM, keyed scatter.
   Show the attack table.
4. **Privacy** — what is on chain (5 hashes) vs what is in Postgres (everything
   else). `keccak256(userId || salt)`, never a name.
5. **Forensic responsibility** — the three bands, and the INCONCLUSIVE screen.
6. **Limits & next steps** — collusion averages fingerprints; Tardos codes are
   the standard answer and our next step. Saying this reads as maturity.
