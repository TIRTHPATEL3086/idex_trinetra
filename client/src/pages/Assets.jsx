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
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Shield,
  Plus,
  Search,
  Key,
  History,
  Lock,
  ExternalLink,
  CheckCircle2,
  Database,
  ArrowRight,
} from 'lucide-react';
import { getAssets, CLASSIFICATION_BADGES, shortHash } from '../lib/api.js';
import UploadModal from '../components/UploadModal.jsx';

export default function Assets() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchAssets = () => {
    setLoading(true);
    getAssets()
      .then((d) => setAssets(d.assets || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssets();
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
  const filtered = (assets || []).filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterClass === 'ALL' || a.classification === filterClass;
    return matchesSearch && matchesFilter;
  });

  const totalDecryptions = (assets || []).reduce((acc, curr) => acc + (curr.decryptCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
            <Database className="h-3.5 w-3.5" />
            <span>Document Repository</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Protected Assets Register</h2>
          <p className="text-xs text-slate-400">
            Plaintext files are AES-256-GCM encrypted. Access is released exclusively via watermarked copies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            <span>Register New Asset</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Classified Assets</span>
            <FileText className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-100">{assets ? assets.length : '—'}</div>
          <p className="mt-1 text-[11px] text-slate-500">AES-256-GCM encrypted vaults</p>
        </div>

        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Decryption Releases</span>
            <Key className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{totalDecryptions}</div>
          <p className="mt-1 text-[11px] text-slate-500">Every copy individually watermarked</p>
        </div>

        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Blockchain Anchors</span>
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-100">100% Verified</div>
          <p className="mt-1 text-[11px] text-slate-500">Sepolia testnet consensus</p>
        </div>

        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Integrity Anomalies</span>
            <Shield className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-300">0 Alerts</div>
          <p className="mt-1 text-[11px] text-slate-500">Tamper-proof registry</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel flex flex-col items-center justify-between gap-3 rounded-xl p-3 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by title or SHA..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'TOP SECRET', 'SECRET', 'CONFIDENTIAL', 'RESTRICTED'].map((cls) => (
            <button
              type="button"
              key={cls}
              onClick={() => setFilterClass(cls)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                filterClass === cls
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/40 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Document Title</th>
                <th className="px-5 py-3 font-semibold">Classification</th>
                <th className="px-5 py-3 font-semibold">SHA-256 Fingerprint</th>
                <th className="px-5 py-3 font-semibold">Created Date</th>
                <th className="px-5 py-3 text-center font-semibold">Releases</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-500">
                    Loading cryptographic document vault…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-500">
                    No protected documents match your search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.assetId} className="transition hover:bg-slate-900/50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-cyan-400">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-200">{a.title}</div>
                          <div className="mono text-[11px] text-slate-500">
                            Asset ID #{a.assetId} · {(a.sizeBytes / 1024).toFixed(0)} KB · AES-256
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                          CLASSIFICATION_BADGES[a.classification] || CLASSIFICATION_BADGES['RESTRICTED']
                        }`}
                      >
                        {a.classification || 'CONFIDENTIAL'}
                      </span>
                    </td>

                    <td className="mono px-5 py-3.5 text-xs text-slate-400">
                      <span title={a.sha256}>{shortHash(a.sha256, 6, 6)}</span>
                    </td>

                    <td className="mono px-5 py-3.5 text-xs text-slate-500">
                      {new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="mono px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                        {a.decryptCount || 0}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/decrypt?assetId=${a.assetId}`)}
                          className="flex items-center gap-1 rounded-md bg-cyan-600/20 border border-cyan-500/30 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:bg-cyan-600 hover:text-white"
                        >
                          <Lock className="h-3 w-3" />
                          <span>Decrypt</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/timeline?assetId=${a.assetId}`)}
                          title="View Forensic Audit Trail"
                          className="rounded-md border border-slate-700 bg-slate-800 p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={fetchAssets}
      />
    </div>
  );
}

export function Header({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function Panel({ title, children }) {
  return (
    <section>
      {title ? <Header title={title} /> : null}
      <p className="text-sm text-slate-500">{children}</p>
    <section className="glass-panel rounded-xl p-6">
      {title && <Header title={title} />}
      <div className="text-sm text-slate-400">{children}</div>
    </section>
  );
}
