import { useCallback, useEffect, useState } from 'react';
import { getAssets, getAudit, toggleUserActive, shortHash } from '../lib/api.js';
import { Header, Notice } from './Assets.jsx';
import { BanIcon, ExternalLinkIcon, UnlockIcon, WarningIcon } from '../components/icons.jsx';
import Select from '../components/Select.jsx';

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

  const reloadTimeline = useCallback(() => {
    if (!assetId) return;
    getAudit(Number(assetId))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [assetId]);

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
  }, [assetId, reloadTimeline]);

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
    <section className="space-y-6">
      <Header
        eyebrow="Audit"
        title="Audit timeline & Anomaly Forensics"
        action={
          <Select
            className="w-56"
            ariaLabel="Document"
            value={assetId}
            onChange={setAssetId}
            options={assets.map((a) => ({ value: a.assetId, label: a.title }))}
          />
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {actionNotice && <Notice tone="success">{actionNotice}</Notice>}
      {!error && !data && <Notice>Loading timeline…</Notice>}
      {data && data.timeline.length === 0 && (
        <Notice>No decryptions recorded for this document yet.</Notice>
      )}

      {data && data.timeline.length > 0 && (
        <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-line sm:before:left-[19px]">
          {data.timeline.map((e) => (
            <li key={e.receiptId} className="relative flex gap-4">
              <span
                className={`z-10 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10 ${
                  e.riskLevel === 'CRITICAL'
                    ? 'bg-danger text-white animate-pulse'
                    : e.riskLevel === 'ELEVATED'
                      ? 'bg-probable text-white'
                      : 'bg-accent text-ink'
                }`}
              >
                <DotGlyph />
              </span>
              <div className="card flex-1 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-ink">{e.userName}</span>
                      {e.riskLevel === 'CRITICAL' && (
                        <span className="rounded-full bg-danger-tint px-2.5 py-0.5 text-xs font-bold text-danger-deep">
                          CRITICAL ANOMALY
                        </span>
                      )}
                      {e.riskLevel === 'ELEVATED' && (
                        <span className="rounded-full bg-probable-tint px-2.5 py-0.5 text-xs font-bold text-probable-deep">
                          ELEVATED RISK
                        </span>
                      )}
                      {e.userActive === false && (
                        <span className="rounded-full bg-danger-deep px-2.5 py-0.5 text-xs font-bold text-white">
                          FROZEN / REVOKED
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-ink-muted mt-0.5">
                      {e.department} · Endpoint:{' '}
                      <span className="font-mono text-xs">{e.device}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-ink-muted font-mono">
                      {new Date(e.at).toLocaleString()}
                    </div>
                    {e.userId && (
                      <button
                        onClick={() => handleToggle(e.userId)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          e.userActive === false
                            ? 'bg-line text-ink hover:bg-line'
                            : 'bg-danger-tint border border-danger-bright text-danger-deep hover:bg-danger-tint'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {e.userActive === false ? (
                            <UnlockIcon size={13} />
                          ) : (
                            <BanIcon size={13} />
                          )}
                          {e.userActive === false ? 'Unfreeze Access' : 'Freeze Access'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Anomaly Badges */}
                {e.anomalies && e.anomalies.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {e.anomalies.map((a, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-probable-tint border border-probable-bright/70 px-2.5 py-0.5 text-xs font-medium text-probable-deep flex items-center gap-1"
                      >
                        <WarningIcon size={12} /> {a}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
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
                      Etherscan <ExternalLinkIcon size={11} />
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
        stroke="#0f151d"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
