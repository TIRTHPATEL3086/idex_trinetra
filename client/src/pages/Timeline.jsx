import { useEffect, useState } from 'react';
import { getAssets, getAudit, toggleUserActive, shortHash } from '../lib/api.js';
import { Header, Notice } from './Assets.jsx';

/**
 * Per-asset audit trail: who opened a document, when, from which device,
 * automated forensic anomaly detection (burst, off-hours, device anomaly),
 * and zero-trust revocation controls.
 */
export default function Timeline() {
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  function reloadTimeline() {
    if (!assetId) return;
    getAudit(Number(assetId))
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    getAssets()
      .then((a) => {
        setAssets(a.assets);
        if (a.assets[0]) setAssetId(String(a.assets[0].assetId));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!assetId) return;
    setData(null);
    reloadTimeline();
  }, [assetId]);

  async function handleToggle(userId) {
    try {
      const res = await toggleUserActive(userId);
      setActionNotice(res.statusMessage);
      reloadTimeline();
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="space-y-3.5">
      <Header
        title="Audit timeline & Anomaly Forensics"
        subtitle="Every decryption of a document, in order — with automated velocity burst, off-hours, device anomaly tracking, and zero-trust revocation."
        action={
          <select
            className="input w-56 !py-1 text-xs sm:text-sm"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            {assets.map((a) => (
              <option key={a.assetId} value={a.assetId}>
                {a.title}
              </option>
            ))}
          </select>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {actionNotice && <Notice tone="success">{actionNotice}</Notice>}
      {!error && !data && <Notice>Loading timeline…</Notice>}
      {data && data.timeline.length === 0 && (
        <Notice>No decryptions recorded for this document yet.</Notice>
      )}

      {data && data.timeline.length > 0 && (
        <ol className="relative space-y-3 before:absolute before:left-[13px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-line sm:before:left-[15px] max-h-[500px] overflow-y-auto scroll-slim pr-1.5">
          {data.timeline.map((e) => (
            <li key={e.receiptId} className="relative flex gap-3 sm:gap-3.5">
              <span className={`z-10 mt-1 grid h-7 w-7 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-full ${
                e.riskLevel === 'CRITICAL'
                  ? 'bg-rose-500 text-white animate-pulse'
                  : e.riskLevel === 'ELEVATED'
                  ? 'bg-amber-500 text-white'
                  : 'bg-lime text-ink'
              }`}>
                <DotGlyph />
              </span>
              <div className="card flex-1 p-3 sm:p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-ink">{e.userName}</span>
                      {e.riskLevel === 'CRITICAL' && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          CRITICAL ANOMALY
                        </span>
                      )}
                      {e.riskLevel === 'ELEVATED' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          ELEVATED RISK
                        </span>
                      )}
                      {e.userActive === false && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          FROZEN / REVOKED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] sm:text-xs text-ink-muted mt-0.5">
                      {e.department} · Endpoint: <span className="font-mono text-[11px]">{e.device}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-right text-[11px] text-ink-muted font-mono">
                      {new Date(e.at).toLocaleString()}
                    </div>
                    {e.userId && (
                      <button
                        onClick={() => handleToggle(e.userId)}
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                          e.userActive === false
                            ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                            : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {e.userActive === false ? 'Unfreeze Access 🔓' : 'Freeze Access 🚫'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Anomaly Badges */}
                {e.anomalies && e.anomalies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.anomalies.map((a, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-amber-50 border border-amber-200/70 px-2 py-0.5 text-[11px] font-medium text-amber-800 flex items-center gap-1"
                      >
                        <span>⚠</span> {a}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mono mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                  <span>receipt {shortHash(e.receiptId, 8, 4)}</span>
                  {e.psnrDb != null && <span>PSNR {e.psnrDb.toFixed(1)} dB</span>}
                  {e.userRef && <span>on-chain {shortHash(e.userRef, 6, 4)}</span>}
                  {e.etherscanUrl && (
                    <a
                      href={e.etherscanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-attributed hover:underline"
                    >
                      Etherscan ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DotGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M12 5l7 7-7 7"
        stroke="#141410"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
