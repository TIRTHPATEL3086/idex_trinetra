# SIH26237 — The 60-Second Demo & Pitch Script
**Track:** Blockchain & Cybersecurity  
**Team Role:** Person C (Driver & Presentation Lead), with Person A & B for technical answers.

> **One-Line Pitch (Bolo stage pe jaate hi):**  
> *"Jab koi secret file kholta hai, hum us copy me Haar-DWT se uska invisible nishan daal dete hain aur record blockchain pe likh dete hain. Baad me file leak ho, to kharab hui file se bhi nishan nikaal ke bata dete hain ki kisne, kab kholi thi — aur kitna pakka hai."*

---

## 1. The 60-Second Timed Run (Rehearse this exact flow)

| Time | UI Action | Dialogue (Hinglish / English) | Speaker | Screen |
|---|---|---|---|---|
| **0:00 - 0:10** | Open **Decrypt** screen. Select *Ops Order 44*, choose *Officer U-017*, click **DECRYPT & ANCHOR RECEIPT**. | *"Ye hamara central defence console hai. Officer U-017 confidential Ops Order khol raha hai. Decrypt hote hi do cheezein hoti hain: background me invisible watermark embed hota hai aur release receipt live Ethereum Sepolia chain pe likh di jaati hai."* | **Person C** | `/decrypt` |
| **0:10 - 0:20** | Receipt card pops up. Hover over on-chain section, then click the **Etherscan Link** (opens in new tab). | *"Notice kijiye — chain pe officer ka real name kabhi nahi jaata, sirf `keccak256(userId \|\| salt)`. Ye dekhiye live public Sepolia transaction — ise koi bhi inspect kar sakta hai, aur hum bhi mita nahi sakte."* | **Person C / B** | Etherscan Tab |
| **0:20 - 0:30** | Switch back to console. Show **Before / After** comparison slider. Slide left & right. | *"Dono documents same dikh rahe hain na? PSNR 42.7 dB hai — human eye se zero difference hai. Lekin frequency domain (Haar-DWT HL/LH sub-band) me is officer ka 48-bit tamper-resistant fingerprint embedded hai."* | **Person A** | `/decrypt` (Slider) |
| **0:30 - 0:40** | Navigate to **Trace** screen. Click the preset: **"WhatsApp JPEG q60 + 50% Resize"** (or drag simulated leaked file). Click **ANALYZE LEAK**. | *"Ab sochiye kisi ne ye document WhatsApp pe forward kiya, screenshot liya ya compress kar diya. Hum is degraded file ko forensic engine me daal rahe hain."* | **Person C** | `/trace` |
| **0:40 - 0:50** | Animated forensic breakdown completes. Verdict pops up in glowing Emerald: **93% ATTRIBUTED**. | *"Engine ne pHash, dHash, aur DWT se watermark extract kiya, Reed-Solomon se damaged bits correct kiye, aur chain receipt cross-verify ki. Verdict: Officer U-017, Ops Wing, DESK-114 — 93% ATTRIBUTED with mathematical proof."* | **Person B / A** | `/trace` (Attributed) |
| **0:50 - 1:00** | Click preset **"Random Unrelated Image"** -> Instant **INCONCLUSIVE (<60%)** verdict in Slate-Grey. | *"Aur sabse important feature: agar file hamari nahi hai ya degraded beyond proof hai — to system kisi pe jhootha aarop nahi lagata. System saaf bolta hai: INCONCLUSIVE. System guess nahi karta."* | **Whole Team** | `/trace` (Inconclusive) |

---

## 2. Robustness Charts Walkthrough (If Judges ask for technical metrics)

1. Navigate to `/robustness`.
2. Point to the **Recharts Attack Survival Bar Chart**:
   - *"8 real-world attacks test kiye hain: JPEG quality 90, 75, 60, 45, 50% Resize, 20% Crop, Gaussian noise, aur Screenshot simulation. Saare attacks me >=40/48 bits survive hue aur Reed-Solomon ECC ne clean recovery di."*
3. Point to the **PSNR vs DELTA Trade-off Curve**:
   - *"Delta=12 hamara sweet spot hai jahan PSNR 42.7 dB rehta hai (imperceptible) aur recovery 48/48 bits rehti hai."*

---

## 3. Viva Objection Defense (Instant Responses)

### Q1: "Why Blockchain? A database would work."
> **Answer (Person B):**  
> *"Sir, agar chori usi officer ya admin ne ki jo database sambhal raha hai, to wo database me apna log delete kar dega. Blockchain ka record immutable hai — ek baar likh diya to hum khud bhi use alter nahi kar sakte."*

### Q2: "Isn't storing user info on public chain a privacy violation?"
> **Answer (Person B):**  
> *"Chain pe naam ya identity kabhi jaati hi nahi. Chain pe sirf `keccak256(userId \|\| salt)` jaata hai. Real identity sirf hamare local private PostgreSQL database me encrypted rehti hai."*

### Q3: "Why not just LSB (Least Significant Bit) watermarking?"
> **Answer (Person A):**  
> *"Ek standard JPEG compression ya WhatsApp share pe LSB poora destroy ho jaata hai. Humne 2-level Haar DWT use karke mid-frequency sub-bands (HL aur LH) me Quantization Index Modulation (QIM) se mark embed kiya hai. Isliye WhatsApp q60 compression pe bhi 45/48 bits survive karte hain."*

### Q4: "What if someone crops the watermark out?"
> **Answer (Person A):**  
> *"Hamare 48 bits 1 fixed jagah pe nahi hain. Keyed pseudo-random permutation se poore image coefficients me 5x repetition ke saath spread hain. 20% crop karne par bhi majority vote se bits recover ho jaate hain."*

### Q5: "What if your system accuses the wrong innocent person?"
> **Answer (Person C):**  
> *"Isi forensic responsibility ke liye hamne 3 strict verdict bands banaye hain: ATTRIBUTED (>=85%), PROBABLE (60-85%), aur INCONCLUSIVE (<60%). Hum kabhi red colour me accusation nahi dikhate, aur <60% pe system saaf bolta hai 'Inconclusive'. Har decision ke peeche plain English reasons[] list hoti hai jo auditable hai."*
