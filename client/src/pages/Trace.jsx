import { useState } from 'react';
import {
  Search,
  Upload,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Cpu,
  Fingerprint,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle,
  FileSearch,
  Clock,
  Radio,
} from 'lucide-react';
import {
  traceFile,
  tracePreset,
  VERDICT_STYLE,
  shortHash,
} from '../lib/api.js';
import { TRACE_PRESETS } from '../lib/mockData.js';

const SCAN_STAGES = [
  'Extracting 64-bit perceptual hashes (pHash, dHash, aHash)…',
  'Querying in-memory BK-Tree index over candidate decryption records…',
  'Applying 2-level inverse Haar DWT to HL and LH frequency sub-bands…',
  'Executing Reed-Solomon RS(12,6) decoding & CRC-8 validation…',
  'Cross-checking Sepolia smart contract for payloadCommit receipt…',
  'Synthesizing Bayesian confidence score across all 5 verification signals…',
];

export default function Trace() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [activePreset, setActivePreset] = useState(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanStageIndex, setScanStageIndex] = useState(0);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setActivePreset(null);
      setResult(null);
    }
  };

  const handleRunPreset = (preset) => {
    setActivePreset(preset.id);
    setSelectedFile(null);
    setFilePreview(null);
    runAnalysis(() => tracePreset(preset.id));
  };

  const handleRunFile = () => {
    if (!selectedFile) return;
    runAnalysis(() => traceFile(selectedFile));
  };

  const runAnalysis = (apiFn) => {
    setIsScanning(true);
    setResult(null);
    setScanStageIndex(0);

    const interval = setInterval(() => {
      setScanStageIndex((prev) => (prev < SCAN_STAGES.length - 1 ? prev + 1 : prev));
    }, 380);

    apiFn().then((res) => {
      clearInterval(interval);
      setScanStageIndex(SCAN_STAGES.length - 1);
      setTimeout(() => {
        setResult(res);
        setIsScanning(false);
      }, 300);
    });
  };

  const verdictConfig = result ? VERDICT_STYLE[result.verdict] : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
          <Fingerprint className="h-3.5 w-3.5" />
          <span>Forensic Attribution Engine</span>
        </div>
        <h2 className="mt-1 text-xl font-semibold text-slate-100">Trace Suspect Leaked Document</h2>
        <p className="text-xs text-slate-400">
          Extract invisible Haar DWT watermark bits from a compressed or cropped leak and attribute the responsible officer.
        </p>
      </div>

      {/* Main Grid: Upload & Presets vs Verdict Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Upload Dropzone + 5 Attack Presets (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 5 Instant Attack Presets for Judges & Live Demo */}
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                1. Test with Attack Presets
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">1-Click Scenarios</span>
            </div>

            <div className="space-y-2">
              {TRACE_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => handleRunPreset(preset)}
                  disabled={isScanning}
                  className={`w-full rounded-lg border p-2.5 text-left transition ${
                    activePreset === preset.id
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{preset.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-semibold border ${
                        preset.result.verdict === 'ATTRIBUTED'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : preset.result.verdict === 'PROBABLE'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            : 'border-slate-600 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {preset.result.verdict}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-tight">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom File Upload Dropzone */}
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
              2. Or Upload Suspect Leak File
            </span>

            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-800 bg-slate-950/60 p-5 hover:border-slate-700">
              {filePreview ? (
                <div className="space-y-2 text-center">
                  <img
                    src={filePreview}
                    alt="Suspect Leak"
                    className="mx-auto h-24 w-32 rounded object-cover border border-slate-700"
                  />
                  <div className="text-[11px] text-slate-300">{selectedFile?.name}</div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-7 w-7 text-slate-500 mb-1.5" />
                  <label className="cursor-pointer text-xs font-medium text-cyan-400 hover:text-cyan-300">
                    <span>Choose suspect image / document</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5">JPEG, PNG, or screenshot</p>
                </div>
              )}
            </div>

            {selectedFile && (
              <button
                type="button"
                onClick={handleRunFile}
                disabled={isScanning}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2 text-xs font-semibold text-white shadow hover:bg-cyan-500 disabled:opacity-50"
              >
                <FileSearch className="h-3.5 w-3.5" />
                <span>Run Forensic Trace on Uploaded File</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Live Analysis or Verdict Card (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Scanning Animation State */}
          {isScanning && (
            <div className="glass-panel rounded-xl p-8 text-center space-y-6">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
                <Radio className="h-8 w-8 animate-pulse text-cyan-400" />
                <div className="absolute inset-0 rounded-2xl ring-2 ring-cyan-400/30 animate-ping" />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  Forensic Extraction Pipeline Running
                </h4>
                <p className="mt-2 text-xs font-mono text-cyan-300">
                  {SCAN_STAGES[scanStageIndex]}
                </p>
              </div>

              <div className="flex justify-center gap-1.5">
                {SCAN_STAGES.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                      i <= scanStageIndex ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Initial Guidance State */}
          {!isScanning && !result && (
            <div className="glass-panel flex flex-col items-center justify-center rounded-xl p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-500">
                <Search className="h-7 w-7" />
              </div>
              <h4 className="mt-4 text-sm font-medium text-slate-200">Awaiting Suspect Document</h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Select one of the <strong className="text-slate-300">Attack Presets</strong> on the left or upload a leaked file to trigger the watermark recovery pipeline.
              </p>
            </div>
          )}

          {/* Verdict Result Card */}
          {!isScanning && result && (
            <div
              className={`glass-panel space-y-5 rounded-xl border p-6 transition-all duration-300 ${
                verdictConfig.border
              } ${verdictConfig.bg} ${verdictConfig.glow}`}
            >
              {/* Verdict Header Badge + Radial Gauge */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-950">
                    {result.verdict === 'ATTRIBUTED' ? (
                      <ShieldCheck className="h-7 w-7 text-emerald-400" />
                    ) : result.verdict === 'PROBABLE' ? (
                      <AlertTriangle className="h-7 w-7 text-amber-400" />
                    ) : (
                      <HelpCircle className="h-7 w-7 text-slate-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold tracking-wide ${verdictConfig.color}`}>
                        {result.verdict}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${verdictConfig.badgeBg}`}>
                        {(result.confidence * 100).toFixed(0)}% Confidence
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{verdictConfig.subLabel}</p>
                  </div>
                </div>

                {/* Processing metrics */}
                <div className="text-right text-[11px] text-slate-500 mono">
                  <div>Candidates Checked: {result.candidatesChecked}</div>
                  <div>Elapsed: {result.elapsedMs} ms</div>
                </div>
              </div>

              {/* Special Polish for INCONCLUSIVE state (Strict Rule 7.2) */}
              {result.verdict === 'INCONCLUSIVE' && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <HelpCircle className="h-4 w-4 text-slate-400" />
                    <span>FORENSIC INTEGRITY: System Guess Nahi Karta</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    The extracted bit agreement and perceptual hash distance fall below the 60% legal threshold. Rather than making a false accusation, the register returns an explicit <strong>INCONCLUSIVE</strong> verdict.
                  </p>
                </div>
              )}

              {/* Attributed / Probable Match Details */}
              {result.match && (
                <div className="space-y-4">
                  {/* Strict Separation: Internal Registry Identity vs On-Chain Proof */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Personnel Registry Box */}
                    <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3.5 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-300">
                        PERSONNEL ATTRIBUTION (PostgreSQL Registry)
                      </div>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="text-slate-500">Responsible Officer: </span>
                          <span className="font-semibold text-slate-100">{result.match.userName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Unit / Department: </span>
                          <span className="text-slate-300">{result.match.department}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Terminal Label: </span>
                          <span className="mono text-slate-300">{result.match.deviceLabel}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Decrypted At: </span>
                          <span className="mono text-slate-400">
                            {new Date(result.match.decryptedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* On-Chain Cryptographic Proof Box */}
                    <div className="rounded-lg border border-cyan-500/30 bg-slate-950/80 p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-400">
                        <span>IMMUTABLE RECEIPT (On-Chain)</span>
                        <span className="text-[10px] font-mono text-cyan-300">Sepolia Block</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="text-slate-500">Document: </span>
                          <span className="text-slate-200">{result.match.assetTitle}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Receipt ID: </span>
                          <span className="mono text-slate-300 truncate block" title={result.match.receiptId}>
                            {shortHash(result.match.receiptId, 10, 8)}
                          </span>
                        </div>
                        <div className="pt-1">
                          <a
                            href={result.match.etherscanUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
                          >
                            <span>Inspect on Etherscan</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Explainability: Plain English reasons[] Bulleted List */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-4 space-y-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Forensic Mathematical Evidence Breakdown
                </span>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {result.reasons?.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
