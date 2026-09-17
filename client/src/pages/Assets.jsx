import { useEffect, useState } from 'react';
import { getAssets } from '../lib/api.js';

/**
 * The document register.
 *
 * TODO: upload dialog (multipart -> uploadAsset), classification badges,
 * empty state, row click -> /timeline?assetId=.
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

  return (
    <section>
      <Header title="Protected documents" />
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-800">
            <th className="pb-2 font-medium">Title</th>
            <th className="pb-2 font-medium">Classification</th>
            <th className="pb-2 font-medium">Created</th>
            <th className="pb-2 text-right font-medium">Decryptions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.assetId} className="border-b border-slate-800/60">
              <td className="py-3 text-slate-200">{a.title}</td>
              <td className="py-3">
                <span className="mono rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {a.classification}
                </span>
              </td>
              <td className="mono py-3 text-xs text-slate-500">
                {new Date(a.createdAt).toLocaleString()}
              </td>
              <td className="mono py-3 text-right text-slate-300">{a.decryptCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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
      <Header title={title} />
      <p className="text-sm text-slate-500">{children}</p>
    </section>
  );
}
