import { useEffect, useState } from 'react';
import { getAssets } from '../lib/api.js';

/**
 * The document register.
 *
 * TODO: upload dialog (multipart -> uploadAsset), classification badges,
 * empty state, row click -> /timeline?assetId=.
 *
 * Responsive: a table from sm up, a stacked card list below it. Neither
 * overflows horizontally at 320px.
 */
export default function Assets() {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAssets()
      .then((d) => setAssets(d.assets))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Panel title="Assets">{error}</Panel>;
  if (!assets) return <Panel title="Assets">Loading documents…</Panel>;
  if (assets.length === 0) return <Panel title="Protected documents">No documents yet.</Panel>;

  return (
    <section>
      <Header title="Protected documents" />

      {/* Card list — mobile. */}
      <ul className="space-y-3 sm:hidden">
        {assets.map((a) => (
          <li key={a.assetId} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words font-medium text-slate-200">{a.title}</span>
              <ClassificationBadge value={a.classification} />
            </div>
            <dl className="mono mt-3 grid grid-cols-2 gap-y-1 text-xs text-slate-500">
              <dt>Created</dt>
              <dd className="text-right text-slate-400">
                {new Date(a.createdAt).toLocaleDateString()}
              </dd>
              <dt>Decryptions</dt>
              <dd className="text-right text-slate-300">{a.decryptCount}</dd>
            </dl>
          </li>
        ))}
      </ul>

      {/* Table — sm and up. */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-800">
              <th className="pb-2 font-medium">Title</th>
              <th className="pb-2 font-medium">Classification</th>
              <th className="hidden pb-2 font-medium md:table-cell">Created</th>
              <th className="pb-2 text-right font-medium">Decryptions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.assetId} className="border-b border-slate-800/60">
                <td className="py-3 pr-3 text-slate-200">{a.title}</td>
                <td className="py-3 pr-3">
                  <ClassificationBadge value={a.classification} />
                </td>
                <td className="mono hidden py-3 pr-3 text-xs text-slate-500 md:table-cell">
                  {new Date(a.createdAt).toLocaleString()}
                </td>
                <td className="mono py-3 text-right text-slate-300">{a.decryptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClassificationBadge({ value }) {
  return (
    <span className="mono shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
      {value}
    </span>
  );
}

export function Header({ title }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium text-slate-100">{title}</h2>
    </div>
  );
}

export function Panel({ title, children }) {
  return (
    <section>
      {title ? <Header title={title} /> : null}
      <p className="text-sm text-slate-500">{children}</p>
    </section>
  );
}
