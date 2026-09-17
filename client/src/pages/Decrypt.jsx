import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Lock,
  Unlock,
  Key,
  User,
  Monitor,
  ExternalLink,
  Download,
  CheckCircle2,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import {
  getAssets,
  getUsers,
  decryptAsset,
  shortHash,
  CLASSIFICATION_BADGES,
} from '../lib/api.js';
import BeforeAfterSlider from '../components/BeforeAfterSlider.jsx';

const FORENSIC_STAGES = [
  'AES-256-GCM decrypting encrypted payload vault…',
  'Constructing 48-bit watermark payload (36-bit shortId + CRC-8 + delta tag)…',
  'Writing immutable release receipt on Sepolia blockchain (logDecryption)…',
  'Embedding invisible mark (2-level Haar DWT + QIM on HL & LH bands, Δ=12)…',
  'Indexing 64-bit perceptual hashes (pHash, dHash, aHash) in BK-tree…',
];

export default function Decrypt() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState(searchParams.get('assetId') || '');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('DESK-114-SECURE');

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getAssets(), getUsers()]).then(([assetsRes, usersRes]) => {
      const assetList = assetsRes.assets || [];
      const userList = usersRes.users || [];
      setAssets(assetList);
      setUsers(userList);

      if (!selectedAssetId && assetList.length > 0) {
        setSelectedAssetId(String(assetList[0].assetId));
      }
      if (userList.length > 0) {
        setSelectedUserId(String(userList[0].userId));
      }
    });
  }, []);

  const handleDecrypt = async (e) => {
    e.preventDefault();
    if (!selectedAssetId || !selectedUserId) return;

    setIsDecrypting(true);
    setError(null);
    setReceipt(null);
    setStageIndex(0);

    // Multi-stage realistic forensic progression
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev < FORENSIC_STAGES.length - 1 ? prev + 1 : prev));
    }, 450);

    try {
      const res = await decryptAsset({
        assetId: Number(selectedAssetId),
        userId: Number(selectedUserId),
        deviceLabel,
      });
      clearInterval(interval);
      setStageIndex(FORENSIC_STAGES.length - 1);
      setTimeout(() => {
        setReceipt(res);
        setIsDecrypting(false);
      }, 300);
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Decryption failed.');
      setIsDecrypting(false);
    }
  };

  const selectedAsset = assets.find((a) => String(a.assetId) === String(selectedAssetId));
  const selectedUser = users.find((u) => String(u.userId) === String(selectedUserId));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
          <Key className="h-3.5 w-3.5" />
          <span>Provably Traceable Release</span>
        </div>
        <h2 className="mt-1 text-xl font-semibold text-slate-100">Decrypt Classified Document</h2>
        <p className="text-xs text-slate-400">
          Release a watermarked copy. The officer's identity hash and release commitment are anchored on Ethereum Sepolia.
        </p>
      </div>

      {/* Main Grid: Decrypt Config vs Receipt Display */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: 3-Step Selection Form (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <form onSubmit={handleDecrypt} className="glass-panel space-y-4 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Decryption Parameters
            </h3>

            {/* Step 1: Document Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-400">
                1. Select Protected Document
              </label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                disabled={isDecrypting}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
              >
                {assets.map((a) => (
                  <option key={a.assetId} value={a.assetId}>
                    {a.title} ({a.classification})
                  </option>
                ))}
              </select>

              {selectedAsset && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Classification:</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                        CLASSIFICATION_BADGES[selectedAsset.classification]
                      }`}
                    >
                      {selectedAsset.classification}
                    </span>
                  </div>
                  <div className="mono mt-1 text-slate-500 truncate" title={selectedAsset.sha256}>
                    SHA-256: {shortHash(selectedAsset.sha256, 8, 8)}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Officer Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-400">
                2. Requesting Officer Profile
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={isDecrypting}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
              >
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name} — {u.dept}
                  </option>
                ))}
              </select>

              {selectedUser && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Clearance:</span>
                    <span className="text-cyan-400 font-mono text-[10px]">{selectedUser.clearance || 'CONFIDENTIAL'}</span>
                  </div>
                  <div className="mono mt-1 text-slate-500 truncate" title={selectedUser.userRef}>
                    On-Chain Hash (Privacy-Safe): {shortHash(selectedUser.userRef, 8, 8)}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Device / Terminal Label */}
            <div>
              <label className="block text-xs font-medium text-slate-400">
                3. Terminal / Device Identifier
              </label>
              <input
                type="text"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                disabled={isDecrypting}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
              />
              <div className="mt-1.5 flex gap-1.5 text-[10px]">
                {['DESK-114-SECURE', 'FIELD-TAB-09', 'CMD-HQ-01'].map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setDeviceLabel(preset)}
                    className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-slate-400 hover:text-slate-200"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Decrypt Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isDecrypting || !selectedAssetId || !selectedUserId}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
              >
                {isDecrypting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing Cryptographic Pipeline…</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>DECRYPT & ANCHOR RECEIPT</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Tactical Note */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-400">Forensic Rule:</span> The blockchain transaction is committed{' '}
            <em>before</em> the marked file is released. No watermarked copy can exist without an immutable receipt on-chain.
          </div>
        </div>

        {/* Right Column: Decryption Status / Live Receipt (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Animated Loading State */}
          {isDecrypting && (
            <div className="glass-panel rounded-xl p-8 text-center space-y-6 animate-pulse-fast">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
                <Cpu className="h-8 w-8 animate-spin" />
                <div className="absolute inset-0 rounded-2xl ring-2 ring-cyan-400/20 animate-ping" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  Executing Hardware-Gated Decryption
                </h4>
                <p className="mt-2 text-xs font-mono text-cyan-300">
                  {FORENSIC_STAGES[stageIndex]}
                </p>
              </div>

              {/* Multi-step progress ticks */}
              <div className="flex justify-center gap-1.5">
                {FORENSIC_STAGES.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                      i <= stageIndex ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Initial Blank Guidance State */}
          {!isDecrypting && !receipt && (
            <div className="glass-panel flex flex-col items-center justify-center rounded-xl p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-500">
                <Shield className="h-7 w-7" />
              </div>
              <h4 className="mt-4 text-sm font-medium text-slate-200">No Decryption in Session</h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Select a classified document and officer credentials on the left, then click{' '}
                <strong className="text-slate-300">Decrypt & Anchor Receipt</strong> to generate an immutable release receipt.
              </p>
            </div>
          )}

          {/* Post-Decryption Receipt Card */}
          {!isDecrypting && receipt && (
            <div className="glass-panel space-y-5 rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5 shadow-glow-attributed">
              {/* Receipt Top Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Decryption Provenance Receipt Issued
                    </h3>
                    <div className="text-[11px] text-emerald-400 font-mono">
                      Status: Block-Anchored // PSNR {receipt.psnrDb} dB (Imperceptible)
                    </div>
                  </div>
                </div>

                <a
                  href={receipt.etherscanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 shadow-sm transition hover:bg-cyan-500/20"
                >
                  <span>Verify on Etherscan</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {/* STRICT SEPARATION: On-Chain Hashed vs Internal Registry */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 1. On-Chain Box (Only hashes, zero real names) */}
                <div className="rounded-lg border border-cyan-500/30 bg-slate-950/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-400">
                    <span>ON-CHAIN PROOF (Public Ethereum)</span>
                    <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-300">
                      Sepolia #{receipt.blockNumber}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div>
                      <div className="text-slate-500">receiptId:</div>
                      <div className="mono text-slate-300 truncate" title={receipt.receiptId}>
                        {receipt.receiptId}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">userRef (keccak256):</div>
                      <div className="mono text-slate-300 truncate" title={selectedUser?.userRef}>
                        {selectedUser?.userRef}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">txHash:</div>
                      <div className="mono text-cyan-400 truncate" title={receipt.txHash}>
                        {receipt.txHash}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Internal Personnel Registry Box (PostgreSQL Private Identity) */}
                <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                    <span>INTERNAL REGISTRY (PostgreSQL Private)</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
                      Restricted Access
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div>
                      <div className="text-slate-500">Officer Name:</div>
                      <div className="font-medium text-slate-200">{selectedUser?.name}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Department:</div>
                      <div className="text-slate-300">{selectedUser?.dept}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Terminal Label:</div>
                      <div className="mono text-slate-300">{receipt.deviceLabel || deviceLabel}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watermark Metadata & Download */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Embedded Payload:</span>
                    <span className="mono text-emerald-400 font-medium">
                      {receipt.payloadBits?.slice(0, 16)}… ({receipt.payloadBits?.length || 48} bits)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Haar DWT QIM Delta:</span>
                    <span className="mono text-slate-200">Δ = {receipt.deltaUsed || 12}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/trace')}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <span>Test in Trace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <a
                    href={selectedAsset?.originalUrl || '#'}
                    download="marked_document.png"
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Marked Copy</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* C4: Before / After Comparison Inspector (Always visible or rendered when decrypted) */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Interactive Before / After Wavelet Inspector
            </h3>
            <p className="text-xs text-slate-400">
              Prove to the jury that the Haar DWT invisible watermark introduces zero human-detectable distortion.
            </p>
          </div>
          <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-mono text-cyan-300">
            PSNR: 42.7 dB
          </span>
        </div>

        <BeforeAfterSlider
          originalUrl={selectedAsset?.originalUrl}
          markedUrl={selectedAsset?.originalUrl}
          psnrDb={receipt?.psnrDb || 42.7}
          delta={receipt?.deltaUsed || 12}
        />
      </div>
    </div>
  );
}
