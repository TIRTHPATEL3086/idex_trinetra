import { useState } from 'react';
import { X, Play, Clock, Sparkles, Shield, AlertTriangle, ExternalLink, Presentation, BookOpen, Layers, CheckCircle } from 'lucide-react';

export default function DemoScriptModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('script'); // 'script' | 'deck'
  const [slideIndex, setSlideIndex] = useState(0);

  if (!isOpen) return null;

  const SLIDES = [
    {
      num: '01 / 06',
      title: 'The Insider Leak Crisis & Problem Statement',
      tagline: 'Traditional encryption stops at decryption. Post-decryption security is zero.',
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <p>
            <strong>The Blindspot:</strong> When an authorized officer opens a classified order, AES decryption completes. If that plaintext document is photographed, screenshot, or forwarded on WhatsApp, standard cybersecurity has zero evidence.
          </p>
          <div className="rounded border border-cyan-500/30 bg-cyan-950/20 p-2.5 text-[11px] text-cyan-300">
            💡 <strong>Our Core Deliverable:</strong> Not encryption itself, but what happens <em>after</em> decryption — embedding an invisible 48-bit Haar DWT watermark and anchoring an immutable receipt on public blockchain.
          </div>
        </div>
      ),
      speaker: 'Person C (30s): Explain the insider leak dilemma and the post-decryption gap.',
    },
    {
      num: '02 / 06',
      title: 'Dual-Pipeline Architecture (Rasta 1 & Rasta 2)',
      tagline: 'Pre-release blockchain anchoring meets in-memory BK-Tree sub-second search.',
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <p>
            <strong>Pipeline 1 (Release):</strong> AES-256-GCM decrypt &rarr; Sepolia on-chain commitment &rarr; Haar DWT QIM embedding &rarr; Marked download.
          </p>
          <p>
            <strong>Pipeline 2 (Trace):</strong> Suspect leak upload &rarr; 64-bit perceptual hashing &rarr; BK-Tree search &rarr; 48-bit DWT extraction &rarr; Reed-Solomon correction &rarr; On-chain receipt verification.
          </p>
          <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-[11px] text-emerald-300">
            ⚡ <strong>Performance:</strong> Sub-second attribution (&lt;800ms) across 10,000 candidate records, 100% CPU-only (no GPUs required).
          </div>
        </div>
      ),
      speaker: 'Person B / C (30s): Walk through the 2 pipelines and explain why the chain write happens before file release.',
    },
    {
      num: '03 / 06',
      title: 'Module A: Hand-Written Haar DWT + QIM',
      tagline: 'Wavelet frequency domain embedding in HL & LH sub-bands (Zero LSB reliance).',
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <p>
            <strong>Why Not LSB?</strong> LSB is wiped out instantly by a single JPEG save.
          </p>
          <p>
            <strong>Sub-band Selection:</strong> 2-Level Haar Wavelet decomposes into LL, HL, LH, HH. We avoid LL (causes visible blur) and HH (destroyed by JPEG). We embed strictly in <strong>HL &amp; LH</strong>.
          </p>
          <div className="rounded border border-slate-700 bg-slate-950 p-2.5 text-[11px] text-slate-300">
            🎯 <strong>QIM at Δ=12:</strong> Yields <strong>PSNR 42.7 dB</strong> (human threshold ~36 dB). Keyed permutation spreads bits with 5× repetition vote — surviving 20% spatial crop attacks!
          </div>
        </div>
      ),
      speaker: 'Person A (40s): Draw the LL/HL/LH/HH box and explain QIM modulation.',
    },
    {
      num: '04 / 06',
      title: 'Zero-Knowledge Blockchain vs PostgreSQL Split',
      tagline: 'Names never touch the public chain. Proof on-chain, search in PostgreSQL.',
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <p>
            <strong>On-Chain (Sepolia):</strong> Only 5 × bytes32 fields (`receiptId`, `assetRef`, `userRef`, `contentSha`, `payloadCommit`) + block timestamp.
          </p>
          <p>
            <strong>Privacy Protection:</strong> `userRef = keccak256(userId || salt)`. Real names reside solely in private PostgreSQL.
          </p>
          <div className="rounded border border-cyan-500/30 bg-cyan-950/20 p-2.5 text-[11px] text-cyan-300">
            🔒 <strong>Anti-Fabrication:</strong> `payloadCommit` proves the watermark was chosen <em>before</em> the leak, preventing post-leak forgery.
          </div>
        </div>
      ),
      speaker: 'Person B (30s): Answer the "Privacy violation?" question with the keccak256 salted hash argument.',
    },
    {
      num: '05 / 06',
      title: 'Forensic Responsibility: The 3 Verdict Bands',
      tagline: 'System guess nahi karta — Never a binary accusation, always mathematically backed.',
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
            <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-300">
              ATTRIBUTED (&ge;85%)<br /><span className="text-[9px] font-normal text-slate-400">Actionable proof</span>
            </div>
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-amber-300">
              PROBABLE (60-85%)<br /><span className="text-[9px] font-normal text-slate-400">Internal audit</span>
            </div>
            <div className="rounded border border-slate-600 bg-slate-800 p-2 text-slate-300">
              INCONCLUSIVE (&lt;60%)<br /><span className="text-[9px] font-normal text-slate-400">No false accusations</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Every verdict provides an explainable <strong>reasons[]</strong> breakdown. If evidence is below 60%, the system proudly states "Inconclusive".
          </p>
        </div>
      ),
      speaker: 'Person C (30s): Emphasize the ethics and forensic responsibility of the Inconclusive state.',
    },
    {
      num: '06 / 06',
      title: 'Empirical Attack Benchmarks & Viva Readiness',
      tagline: '8/8 Real-world digital attacks survived with Reed-Solomon RS(12,6) ECC.',
      content: (
        <div className="space-y-2 text-xs text-slate-300">
          <p>
            <strong>Tested Attacks:</strong> JPEG q90 (48/48), JPEG q75 (47/48), WhatsApp JPEG q60 (45/48), JPEG q45 (43/48), 50% Resize (44/48), 20% Crop (41/48), Gaussian Noise (42/48), Screenshot Moiré (40/48).
          </p>
          <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-[11px] text-emerald-300">
            🏆 <strong>Final Summary:</strong> 100% Attribution survival rate, live interactive sandbox, and live Sepolia testnet verification.
          </div>
        </div>
      ),
      speaker: 'Whole Team (20s): Conclude the pitch and invite the judges to try the live degradation sliders.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl">
        {/* Header with Tab Switcher */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Presentation className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Presentation & Pitch Kit (Person C)</h3>
              <p className="text-[11px] text-cyan-400">SIH26237 — Decryption Provenance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('script')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  activeTab === 'script' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                60s Demo Script
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('deck')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  activeTab === 'deck' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                6-Slide Pitch Deck
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* TAB 1: 60-Second Demo Script */}
        {activeTab === 'script' && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3.5">
              <div className="text-[11px] font-semibold tracking-wide uppercase text-cyan-400">
                Opening 1-Line Pitch (Bolo stage pe jaate hi)
              </div>
              <p className="mt-1 text-xs italic text-slate-200">
                "Jab koi secret file kholta hai, hum us copy me Haar-DWT se uska invisible nishan daal dete hain aur record blockchain pe likh dete hain. Baad me file leak ho, to kharab hui file se bhi nishan nikaal ke bata dete hain ki kisne, kab kholi thi — aur kitna pakka hai."
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">0:00 - 0:15</span>
                    Step 1: Decrypt &amp; Anchor on Blockchain
                  </span>
                  <span className="text-[11px] text-slate-500">Screen: /decrypt</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Pick <strong>Ops Order 44</strong>, choose <strong>Officer U-017</strong>, click <strong>Decrypt &amp; Anchor</strong>.
                </p>
                <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
                  🗣️ <em>"Officer file khol raha hai. Decrypt hote hi do cheezein hoti hain: background me invisible watermark embed hota hai aur release receipt live Ethereum Sepolia chain pe likh di jaati hai."</em>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">0:15 - 0:25</span>
                    Step 2: Show Etherscan Link &amp; Privacy Split
                  </span>
                  <span className="text-[11px] text-slate-500">Receipt Card</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Click the <strong>Etherscan Link</strong> and highlight that real names are NEVER on-chain.
                </p>
                <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
                  🗣️ <em>"Ye live Sepolia transaction hai. Notice kijiye — chain pe naam nahi hai, sirf `keccak256(userId || salt)`. Real identity sirf private database me hai. Blockchain proof deta hai, Postgres search deta hai."</em>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">0:25 - 0:35</span>
                    Step 3: Before / After Slider (Invisibility Proof)
                  </span>
                  <span className="text-[11px] text-slate-500">Screen: Slider</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Drag the split slider left &amp; right. Toggle "Show 20× Difference Map".
                </p>
                <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
                  🗣️ <em>"Dono same dikh rahe hain na? PSNR 42.7 dB hai. Farak aankh se dikhta hi nahi, par frequency domain me is officer ka 48-bit tamper-resistant mark embedded hai."</em>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">0:35 - 0:48</span>
                    Step 4: Trace WhatsApp Leaked File
                  </span>
                  <span className="text-[11px] text-slate-500">Screen: /trace</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Click preset <strong>"WhatsApp JPEG q60"</strong> &rarr; Click <strong>Run Forensic Trace</strong>.
                </p>
                <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
                  🗣️ <em>"Ab file leak ho gayi WhatsApp pe. Forensic engine ne pHash, Haar DWT se mark nikala, Reed-Solomon se damaged bits correct kiye, aur Sepolia chain se cross-verify kiya: Officer U-017, 93% ATTRIBUTED!"</em>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">0:48 - 1:00</span>
                    Step 5: The INCONCLUSIVE State (Crucial Winning Move)
                  </span>
                  <span className="text-[11px] text-slate-500">Negative Control</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Click preset <strong>"Unrelated Random Photo"</strong> &rarr; Show the slate-grey Inconclusive card.
                </p>
                <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
                  🗣️ <em>"Aur sabse bada feature: agar photo unrelated hai, to system kisi par jhootha aarop nahi lagata. System saaf bolta hai: INCONCLUSIVE. System guess nahi karta."</em>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Interactive 6-Slide Pitch Deck */}
        {activeTab === 'deck' && (
          <div className="mt-4 space-y-4">
            {/* Slide Navigation Header */}
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs">
              <span className="mono font-semibold text-cyan-400">
                SLIDE {SLIDES[slideIndex].num}
              </span>
              <div className="flex gap-1.5">
                {SLIDES.map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setSlideIndex(i)}
                    className={`h-2 w-7 rounded-full transition ${
                      i === slideIndex ? 'bg-cyan-400' : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={slideIndex === 0}
                  onClick={() => setSlideIndex(slideIndex - 1)}
                  className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={slideIndex === SLIDES.length - 1}
                  onClick={() => setSlideIndex(slideIndex + 1)}
                  className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Slide Body */}
            <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-6 space-y-4 shadow-xl">
              <div>
                <h4 className="text-base font-bold text-slate-100">{SLIDES[slideIndex].title}</h4>
                <p className="text-xs text-cyan-400 mt-0.5">{SLIDES[slideIndex].tagline}</p>
              </div>

              <div className="border-t border-slate-800/80 pt-3">
                {SLIDES[slideIndex].content}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[11px] text-slate-400">
                🗣️ <strong>Speaker Note:</strong> {SLIDES[slideIndex].speaker}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-cyan-600 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
