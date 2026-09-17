import { useEffect, useState } from 'react';
import { getAssets, getAudit, shortHash } from '../lib/api.js';
import { Header, Notice } from './Assets.jsx';

/**
 * Per-asset audit trail: who opened a document, when, from which device, and
 * the transaction that proves it. The hashed on-chain handle and the real name
 * are shown as separate, labelled things.
 */
export default function Timeline() {
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

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
    getAudit(Number(assetId))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [assetId]);

  return (
    <section className="space-y-6">
      <Header
        title="Audit timeline"
        subtitle="Every decryption of a document, in order — who, when, from which device, and the on-chain receipt."
        action={
          <select
            className="input w-56"
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
      {!error && !data && <Notice>Loading timeline…</Notice>}
      {data && data.timeline.length === 0 && (
        <Notice>No decryptions recorded for this document yet.</Notice>
      )}

      {data && data.timeline.length > 0 && (
        <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-line sm:before:left-[19px]">
          {data.timeline.map((e) => (
            <li key={e.receiptId} className="relative flex gap-4">
              <span className="z-10 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime sm:h-10 sm:w-10">
                <DotGlyph />
              </span>
              <div className="card flex-1 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-ink">{e.userName}</div>
                    <div className="text-xs text-ink-muted">
                      {e.department} · {e.device}
                    </div>
                  </div>
                  <div className="text-right text-xs text-ink-muted">
                    {new Date(e.at).toLocaleString()}
                  </div>
                </div>
                <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
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
