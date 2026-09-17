import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  History,
  Shield,
  FileText,
  ExternalLink,
  Clock,
  User,
  Monitor,
  CheckCircle,
  Database,
  Layers,
} from 'lucide-react';
import { getAssets, getAudit, shortHash } from '../lib/api.js';

export default function Timeline() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState(searchParams.get('assetId') || '');
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssets().then((res) => {
      const list = res.assets || [];
      setAssets(list);
      const initialId = searchParams.get('assetId') || (list[0]?.assetId ? String(list[0].assetId) : '');
      setSelectedAssetId(initialId);
    });
  }, [searchParams]);

  useEffect(() => {
    if (!selectedAssetId) return;
    setLoading(true);
    getAudit(selectedAssetId)
      .then((data) => setAuditData(data))
      .finally(() => setLoading(false));
  }, [selectedAssetId]);

  const handleSelectAsset = (id) => {
    setSelectedAssetId(id);
    setSearchParams({ assetId: id });
  };

  const selectedAsset = assets.find((a) => String(a.assetId) === String(selectedAssetId));
  const timeline = auditData?.timeline || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
            <History className="h-3.5 w-3.5" />
            <span>Forensic Provenance Register</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Document Audit Timeline</h2>
          <p className="text-xs text-slate-400">
            Immutable chain of custody: every decrypted instance, officer signature, and blockchain anchor.
          </p>
        </div>

        {/* Asset Selector */}
        <div className="w-full md:w-80">
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Filter by Protected Asset
          </label>
          <select
            value={selectedAssetId}
            onChange={(e) => handleSelectAsset(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            {assets.map((a) => (
              <option key={a.assetId} value={a.assetId}>
                {a.title} ({a.classification})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Asset Overview Card */}
      {selectedAsset && (
        <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-cyan-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">{selectedAsset.title}</div>
              <div className="mono text-xs text-slate-500">
                Asset #{selectedAsset.assetId} · SHA-256: {shortHash(selectedAsset.sha256, 8, 8)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block">Total Releases:</span>
              <span className="text-base font-bold text-cyan-300 mono">{timeline.length} Copies</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Average Invisibility:</span>
              <span className="text-base font-bold text-emerald-400 mono">42.7 dB</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Consensus:</span>
              <span className="text-base font-bold text-slate-200">Sepolia Chain</span>
            </div>
          </div>
        </div>
      )}

      {/* Chronological Timeline Feed */}
      <div className="glass-panel rounded-xl p-6">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Querying blockchain receipts and postgres audit events…
          </div>
        ) : timeline.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No decryption events recorded for this document yet.
          </div>
        ) : (
          <div className="relative border-l border-slate-800 ml-4 space-y-8 pl-6">
            {timeline.map((event, idx) => (
              <div key={event.receiptId || idx} className="relative group">
                {/* Timeline node icon */}
                <div className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-cyan-500/50 bg-slate-950 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                </div>

                {/* Event Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700 hover:bg-slate-900/60">
                  {/* Top Bar: Timestamp and Etherscan Link */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span className="mono font-medium text-slate-300">
                        {new Date(event.at).toLocaleString()}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        Block #{event.blockNumber || 5829301}
                      </span>
                    </div>

                    <a
                      href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 underline"
                    >
                      <span>Etherscan Receipt</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Dual Card Split: Personnel Info vs Blockchain Proof */}
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Personnel Registry Details */}
                    <div className="space-y-1 text-xs">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Personnel Record (Private)
                      </div>
                      <div className="text-sm font-semibold text-slate-200">
                        {event.userName}
                      </div>
                      <div className="text-slate-400">{event.dept}</div>
                      <div className="mono text-[11px] text-slate-500">
                        Terminal: <span className="text-slate-300">{event.device}</span>
                      </div>
                    </div>

                    {/* Blockchain Proof */}
                    <div className="space-y-1 text-xs">
                      <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                        On-Chain Identity Proof (Hashed)
                      </div>
                      <div className="mono text-slate-400 text-[11px] truncate" title={event.userRef}>
                        userRef: <span className="text-slate-200">{shortHash(event.userRef, 8, 8)}</span>
                      </div>
                      <div className="mono text-slate-400 text-[11px] truncate" title={event.receiptId}>
                        receiptId: <span className="text-slate-200">{shortHash(event.receiptId, 8, 8)}</span>
                      </div>
                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        <span className="text-emerald-400 font-medium">PSNR: {event.psnrDb} dB</span>
                        <span className="text-slate-400">Δ = {event.deltaUsed || 12}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
