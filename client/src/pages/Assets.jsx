import { useCallback, useEffect, useState } from 'react';
import { getAssets, uploadAsset } from '../lib/api.js';

/**
 * The document register.
 *
 * Responsive: dark overview panel of stat tiles, then a table (sm+) or a
 * stacked card list (mobile). Nothing overflows horizontally at 320px.
 */
export default function Assets() {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const reload = useCallback(() => {
    getAssets()
      .then((d) => setAssets(d.assets))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section className="space-y-6">
      <Header
        title="Protected documents"
        subtitle="Encrypted at rest. Every decryption is watermarked and anchored on-chain."
        action={
          <button type="button" className="btn-lime" onClick={() => setUploadOpen(true)}>
            <PlusIcon />
            Upload document
          </button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !assets && <Notice>Loading documents…</Notice>}

      {!error && assets && <Overview assets={assets} />}

      {!error && assets?.length === 0 && <Notice>No documents yet. Upload one to begin.</Notice>}

      {!error && assets?.length > 0 && <DocumentList assets={assets} />}

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            setUploadOpen(false);
            reload();
          }}
        />
      )}
    </section>
  );
}

/* -- upload modal ----------------------------------------------------------- */

function UploadModal({ onClose, onDone }) {
  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState('CONFIDENTIAL');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | working | error
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setStatus('working');
    setError(null);
    try {
      await uploadAsset({ file, title: title.trim(), classification });
      onDone();
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-night/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-extrabold text-ink">Upload a document</h3>
          <button type="button" onClick={onClose} className="btn-icon !h-8 !w-8" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="text-sm text-ink-muted">
          The file is SHA-256 hashed and AES-256-GCM encrypted before it touches disk. The plaintext
          is never stored.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">
            Title
          </span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ops Order 45"
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">
            Classification
          </span>
          <select
            className="input"
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
          >
            <option value="RESTRICTED">RESTRICTED</option>
            <option value="CONFIDENTIAL">CONFIDENTIAL</option>
            <option value="SECRET">SECRET</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">
            Image file
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-night file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-night-soft"
          />
        </label>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex gap-3 pt-1">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-lime flex-1"
            disabled={status === 'working' || !file || !title.trim()}
          >
            {status === 'working' ? 'Encrypting…' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* -- dark overview panel, styled after the reference "Payments" card -------- */

function Overview({ assets }) {
  const documents = assets.length;
  const decryptions = assets.reduce((n, a) => n + (a.decryptCount || 0), 0);
  const secret = assets.filter((a) => a.classification === 'SECRET').length;
  const restricted = assets.filter((a) => a.classification === 'RESTRICTED').length;

  return (
    <div className="rounded-3xl bg-night bg-gradient-to-br from-[#20220f] to-night p-4 shadow-panel sm:p-5">
      <div className="mb-4 flex items-center justify-between px-1">
        <h3 className="text-base font-bold text-white">Register overview</h3>
        <span className="mono rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70">
          Live
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Documents" value={documents} highlight />
        <Tile label="Decryptions" value={decryptions} note="on-chain receipts" />
        <Tile label="Classified SECRET" value={secret} />
        <Tile label="Restricted" value={restricted} />
      </div>
    </div>
  );
}

function Tile({ label, value, note, highlight }) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        highlight ? 'bg-lime text-night' : 'bg-white/[0.06] text-white'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-xs font-semibold ${highlight ? 'text-night/70' : 'text-white/60'}`}>
          {label}
        </span>
        <span
          className={`grid h-6 w-6 place-items-center rounded-full ${
            highlight ? 'bg-night/10' : 'bg-white/10'
          }`}
        >
          <ArrowUpRight highlight={highlight} />
        </span>
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight">{value}</div>
      <div className={`mt-0.5 text-[11px] ${highlight ? 'text-night/60' : 'text-white/45'}`}>
        {note || 'in the register'}
      </div>
    </div>
  );
}

/* -- document list ---------------------------------------------------------- */

function DocumentList({ assets }) {
  return (
    <>
      {/* Card list — mobile. */}
      <ul className="space-y-3 sm:hidden">
        {assets.map((a) => (
          <li key={a.assetId} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words font-bold text-ink">{a.title}</span>
              <ClassificationBadge value={a.classification} />
            </div>
            <dl className="mono mt-3 grid grid-cols-2 gap-y-1.5 text-xs text-ink-muted">
              <dt>Created</dt>
              <dd className="text-right text-ink">{new Date(a.createdAt).toLocaleDateString()}</dd>
              <dt>Decryptions</dt>
              <dd className="text-right font-bold text-ink">{a.decryptCount}</dd>
            </dl>
          </li>
        ))}
      </ul>

      {/* Table — sm and up. */}
      <div className="card hidden overflow-hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3.5 font-bold">Document</th>
              <th className="px-5 py-3.5 font-bold">Classification</th>
              <th className="hidden px-5 py-3.5 font-bold md:table-cell">Created</th>
              <th className="px-5 py-3.5 text-right font-bold">Decryptions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr
                key={a.assetId}
                className="border-b border-line/70 transition last:border-0 hover:bg-line/30"
              >
                <td className="px-5 py-4 font-bold text-ink">{a.title}</td>
                <td className="px-5 py-4">
                  <ClassificationBadge value={a.classification} />
                </td>
                <td className="mono hidden px-5 py-4 text-xs text-ink-muted md:table-cell">
                  {new Date(a.createdAt).toLocaleString()}
                </td>
                <td className="mono px-5 py-4 text-right font-bold text-ink">{a.decryptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const CLASS_STYLE = {
  RESTRICTED: 'bg-line text-ink-muted',
  CONFIDENTIAL: 'bg-lime text-night',
  SECRET: 'bg-night text-white',
};

function ClassificationBadge({ value }) {
  return (
    <span className={`pill shrink-0 ${CLASS_STYLE[value] || 'bg-line text-ink-muted'}`}>
      {value}
    </span>
  );
}

/* -- shared building blocks reused across the other screens ----------------- */

export function Header({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
          {title}
        </h2>
        {subtitle && <p className="mt-1 max-w-xl text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Notice({ children, tone = 'default' }) {
  const styles =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-line bg-white text-ink-muted';
  return <div className={`rounded-2xl border px-5 py-4 text-sm ${styles}`}>{children}</div>;
}

/** Kept for screens that still import Panel. */
export function Panel({ title, subtitle, children }) {
  return (
    <section className="space-y-6">
      {title && <Header title={title} subtitle={subtitle} />}
      <Notice>{children}</Notice>
    </section>
  );
}

/* -- icons ------------------------------------------------------------------ */

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpRight({ highlight }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke={highlight ? '#141410' : '#fff'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
