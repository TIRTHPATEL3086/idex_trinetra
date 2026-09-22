import { useCallback, useEffect, useState } from 'react';
import { getAssets, uploadAsset, getUsers } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

/**
 * The document register.
 *
 * Responsive: dark overview panel of stat tiles, then a table (sm+) or a
 * stacked card list (mobile). Nothing overflows horizontally at 320px.
 */
export default function Assets() {
  const { can } = useAuth();
  const mayUpload = can('assets:upload');

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
        subtitle="Encrypted at rest with NIST ML-KEM-768 broadcast encryption. Every decryption is watermarked and anchored on-chain."
        action={
          mayUpload ? (
            <button type="button" className="btn-lime" onClick={() => setUploadOpen(true)}>
              <PlusIcon />
              Upload document
            </button>
          ) : null
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !assets && <Notice>Loading documents…</Notice>}

      {!error && assets && <Overview assets={assets} />}

      {!error && assets?.length === 0 && (
        <Notice>
          {mayUpload
            ? 'No documents yet. Upload one to begin.'
            : 'No documents in the register yet. An administrator adds them.'}
        </Notice>
      )}

      {!error && assets?.length > 0 && <DocumentList assets={assets} />}

      {uploadOpen && mayUpload && (
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
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  useEffect(() => {
    getUsers()
      .then((data) => {
        const eligible = (data.users || []).filter((u) => u.active);
        setAvailableUsers(eligible);
        setSelectedUserIds(eligible.map((u) => u.userId));
      })
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setStatus('working');
    setError(null);
    try {
      await uploadAsset({
        file,
        title: title.trim(),
        classification,
        authorizedUserIds: selectedUserIds,
      });
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
          The file is SHA-256 hashed and encrypted with AES-256-GCM. The content key is encapsulated using NIST ML-KEM-768 for each authorized recipient.
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
            Document Image or PDF
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-night file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-night-soft"
          />
        </label>

        {/* Authorized Recipients Picker */}
        {availableUsers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                Authorized Recipients (ML-KEM-768)
              </span>
              <span className="text-[11px] text-lime-deep font-semibold">
                {selectedUserIds.length} of {availableUsers.length} selected
              </span>
            </div>
            <div className="max-h-28 overflow-y-auto rounded-xl border border-line p-2 space-y-1 bg-line/10">
              {availableUsers.map((u) => {
                const checked = selectedUserIds.includes(u.userId);
                return (
                  <label
                    key={u.userId}
                    className="flex items-center justify-between gap-2 text-xs text-ink cursor-pointer hover:bg-white/60 p-1 rounded-lg"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedUserIds((prev) =>
                            checked ? prev.filter((id) => id !== u.userId) : [...prev, u.userId]
                          );
                        }}
                        className="rounded text-lime-deep focus:ring-lime"
                      />
                      <span className="font-semibold">{u.name}</span>
                      <span className="text-ink-muted">· {u.dept}</span>
                    </span>
                    <span className="pill !text-[10px] !py-0.5">{u.role}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

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
            {status === 'working' ? 'Encrypting & Encapsulating…' : 'Upload'}
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

  return (
    <div className="relative overflow-hidden rounded-3xl bg-night p-6 text-white shadow-panel sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            Registry overview
          </div>
          <div className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {documents} <span className="text-white/40 font-normal">protected documents</span>
          </div>
          <p className="mt-1 text-xs text-white/60">
            Every document is AES-256-GCM encrypted. Each release writes an immutable receipt to the
            blockchain and embeds an invisible Haar-DWT watermark.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Documents" value={documents} />
          <StatTile label="Secret" value={secret} />
          <StatTile label="Decryptions" value={decryptions} highlight />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, highlight }) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl p-4 transition ${
        highlight ? 'bg-lime text-night' : 'bg-night-soft text-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] font-bold uppercase tracking-wider ${
            highlight ? 'text-night/70' : 'text-white/50'
          }`}
        >
          {label}
        </span>
        <ArrowUpRight highlight={highlight} />
      </div>
      <div className="font-display mt-3 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

/* -- document list: cards on mobile, table on sm+ --------------------------- */

function DocumentList({ assets }) {
  return (
    <>
      {/* Cards — mobile only. */}
      <ul className="space-y-3 sm:hidden">
        {assets.map((a) => (
          <li key={a.assetId} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-ink">{a.title}</div>
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
              <th className="px-5 py-3.5 font-bold">PQC Broadcast Encryption</th>
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
                <td className="px-5 py-4">
                  <span className="pill !bg-emerald-50 !text-emerald-700 font-semibold">
                    {a.encapsulationCount ?? a.authorizedUserIds?.length ?? 0} Recipients (ML-KEM-768)
                  </span>
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
