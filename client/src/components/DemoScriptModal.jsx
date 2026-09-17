import { X, Play, Clock, Sparkles, Shield, AlertTriangle, ExternalLink } from 'lucide-react';

export default function DemoScriptModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Play className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">60-Second Demo Presentation Script</h3>
              <p className="text-[11px] text-cyan-400">SIH26237 — Crypto Decryption Provenance Walkthrough</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* The Pitch Banner */}
        <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3.5">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-cyan-400">Opening 1-Line Pitch (Sabse Pehle Bolo)</div>
          <p className="mt-1 text-xs italic text-slate-200">
            "Jab koi secret file kholta hai, hum us copy me Haar-DWT se uska invisible nishan daal dete hain aur record blockchain pe likh dete hain. Baad me file leak ho, to kharab hui file se bhi nishan nikaal ke bata dete hain ki kisne, kab kholi thi — aur kitna pakka hai."
          </p>
        </div>

        {/* Step-by-Step 60s Flow */}
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">0:00 - 0:15</span>
                Step 1: Decrypt & Anchor on Blockchain
              </span>
              <span className="text-[11px] text-slate-500">Screen: /decrypt</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Pick <strong>Ops Order 44</strong>, select <strong>Officer U-017</strong>, click <strong>Decrypt & Anchor</strong>.
            </p>
            <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
              🗣️ <em>"Officer file khol raha hai. Decrypt hote hi do cheezein hoti hain: background me invisible watermark embed hota hai aur release receipt live Ethereum Sepolia chain pe likh di jaati hai."</em>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">0:15 - 0:25</span>
                Step 2: Show Etherscan Link & Privacy Split
              </span>
              <span className="text-[11px] text-slate-500">Receipt Card</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Click the <strong>Etherscan Link</strong> and highlight that real names are NEVER on-chain.
            </p>
            <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
              🗣️ <em>"Ye live Sepolia transaction hai. Notice kijiye — chain pe naam nahi hai, sirf `keccak256(userId || salt)`. Real identity sirf private database me hai. Blockchain proof deta hai, Postgres search deta hai."</em>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">0:25 - 0:35</span>
                Step 3: Before / After Slider (Invisibility Proof)
              </span>
              <span className="text-[11px] text-slate-500">Screen: Slider</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Drag the split slider left & right. Toggle "Show 20× Difference Map".
            </p>
            <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
              🗣️ <em>"Dono same dikh rahe hain na? PSNR 42.7 dB hai. Farak aankh se dikhta hi nahi, par frequency domain me is officer ka 48-bit tamper-resistant mark embedded hai."</em>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">0:35 - 0:48</span>
                Step 4: Trace WhatsApp Leaked File
              </span>
              <span className="text-[11px] text-slate-500">Screen: /trace</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Click preset <strong>"WhatsApp JPEG q60"</strong> &rarr; Click <strong>Run Forensic Trace</strong>.
            </p>
            <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
              🗣️ <em>"Ab file leak ho gayi WhatsApp pe. Forensic engine ne pHash, Haar DWT se mark nikala, Reed-Solomon se damaged bits correct kiye, aur Sepolia chain se cross-verify kiya: Officer U-017, 93% ATTRIBUTED!"</em>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">0:48 - 1:00</span>
                Step 5: The INCONCLUSIVE State (Crucial Winning Move)
              </span>
              <span className="text-[11px] text-slate-500">Negative Control</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Click preset <strong>"Unrelated Random Photo"</strong> &rarr; Show the slate-grey Inconclusive card.
            </p>
            <div className="mt-1 rounded border border-slate-800 bg-slate-900/80 p-2 text-[11px] text-slate-300">
              🗣️ <em>"Aur sabse bada feature: agar photo unrelated hai, to system kisi par jhootha aarop nahi lagata. System saaf bolta hai: INCONCLUSIVE. System guess nahi karta."</em>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-cyan-600 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-500"
          >
            Ready for Demo
          </button>
        </div>
      </div>
    </div>
  );
}
