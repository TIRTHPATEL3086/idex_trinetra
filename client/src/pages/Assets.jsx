import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [droppedInitialFile, setDroppedInitialFile] = useState(null);
  const [pageDragging, setPageDragging] = useState(false);

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
            <button
              type="button"
              className="btn-lime"
              onClick={() => {
                setDroppedInitialFile(null);
                setUploadOpen(true);
              }}
            >
              <PlusIcon />
              Upload document
            </button>
          ) : null
        }
      />

      {mayUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPageDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPageDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPageDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) {
              setDroppedInitialFile(dropped);
              setUploadOpen(true);
            }
          }}
          onClick={() => {
            setDroppedInitialFile(null);
            setUploadOpen(true);
          }}
          className={`cursor-pointer rounded-3xl border-2 border-dashed p-5 text-center transition-all duration-200 ${
            pageDragging
              ? 'border-lime-deep bg-lime/20 scale-[1.01] shadow-lg ring-4 ring-lime/30'
              : 'border-line/80 bg-gradient-to-r from-[#fbfbf7] to-white hover:border-lime-deep hover:bg-lime/5'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime text-night shadow-sm">
              <PlusIcon />
            </div>
            <div className="text-center sm:text-left">
              <div className="text-sm sm:text-base font-bold text-ink">
                {pageDragging
                  ? 'Release to upload & protect document!'
                  : 'Drag & drop PDF or Image here to protect, or click to upload'}
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                Post-quantum NIST ML-KEM-768 broadcast encryption · Instant perceptual hashing
              </div>
            </div>
          </div>
        </div>
      )}

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
          initialFile={droppedInitialFile}
          onClose={() => {
            setUploadOpen(false);
            setDroppedInitialFile(null);
          }}
          onDone={() => {
            setUploadOpen(false);
            setDroppedInitialFile(null);
            reload();
          }}
        />
      )}
    </section>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DragDropInput({ file, onFileChange }) {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) onFileChange(droppedFile);
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-bold uppercase tracking-wide text-ink-faint">
        Document PDF or Image <span className="text-rose-500">*</span>
      </span>
      {file ? (
        <div className="flex items-center justify-between rounded-2xl border-2 border-lime/60 bg-lime/10 p-3.5 transition">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-night text-lime font-extrabold text-xs">
              {file.name.endsWith('.pdf') ? 'PDF' : 'IMG'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-ink">{file.name}</div>
              <div className="text-[11px] text-ink-muted">{formatBytes(file.size)} · Ready to encrypt</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="rounded-lg p-1.5 text-xs text-ink-muted hover:bg-white hover:text-rose-600 transition"
            title="Remove file"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
            isOver
              ? 'border-lime-deep bg-lime/15 scale-[1.01] shadow-inner'
              : 'border-line hover:border-lime-deep bg-[#fbfbf7] hover:bg-lime/5'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) onFileChange(e.target.files[0]);
            }}
          />
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-lime text-night mb-2 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="text-xs font-bold text-ink">
            {isOver ? 'Drop file to upload!' : 'Drag & drop PDF / Image here, or click to browse'}
          </div>
          <div className="mt-1 text-[11px] text-ink-muted">
            Supports PDF, PNG, JPG, WEBP (Max 50MB)
          </div>
        </div>
      )}
    </div>
  );
}

/* -- upload modal ----------------------------------------------------------- */

function UploadModal({ initialFile, onClose, onDone }) {
  const [title, setTitle] = useState(
    initialFile ? initialFile.name.replace(/\.[^/.]+$/, '') : ''
  );
  const [classification, setClassification] = useState('CONFIDENTIAL');
  const [file, setFile] = useState(initialFile || null);
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

        <DragDropInput
          file={file}
          onFileChange={(f) => {
            setFile(f);
            if (f && !title.trim()) {
              setTitle(f.name.replace(/\.[^/.]+$/, ''));
            }
          }}
        />

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
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-400">
            <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse" />
            Registry overview
          </div>
          <div className="font-display mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
            {documents} <span className="text-white/40 font-normal">protected documents</span>
          </div>
          <p className="mt-2 max-w-xl text-xs sm:text-sm text-white/70 leading-relaxed">
            Every document is encrypted with AES-256-GCM. Content keys are encapsulated per recipient with NIST ML-KEM-768. Decryptions embed invisible Haar-DWT watermarks and anchor immutable receipts on the Ethereum blockchain.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 shrink-0 w-full xl:w-auto">
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
      className={`flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 transition min-w-[90px] sm:min-w-[110px] ${
        highlight ? 'bg-lime text-night shadow-md' : 'bg-night-soft text-white'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${
            highlight ? 'text-night/80' : 'text-white/60'
          }`}
        >
          {label}
        </span>
        <ArrowUpRight highlight={highlight} />
      </div>
      <div className="font-display mt-2 sm:mt-3 text-2xl sm:text-3xl font-extrabold">{value}</div>
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
          <li key={a.assetId} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-ink text-sm">{a.title}</div>
              <ClassificationBadge value={a.classification} />
            </div>
            <div className="text-xs text-ink-muted">
              <span className="pill !bg-emerald-50 !text-emerald-700 text-xs font-semibold">
                {a.encapsulationCount ?? a.authorizedUserIds?.length ?? 0} Recipients (ML-KEM-768)
              </span>
            </div>
            <dl className="mono grid grid-cols-2 gap-y-1.5 text-xs text-ink-muted pt-2 border-t border-line/60">
              <dt>Created</dt>
              <dd className="text-right text-ink font-semibold">{new Date(a.createdAt).toLocaleDateString()}</dd>
              <dt>Decryptions</dt>
              <dd className="text-right font-extrabold text-ink">{a.decryptCount}</dd>
            </dl>
          </li>
        ))}
      </ul>

      {/* Table — sm and up with smooth horizontal scroll and minimum column widths */}
      <div className="card hidden overflow-x-auto scroll-slim sm:block shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line bg-night/[0.02] text-left text-xs uppercase tracking-wider text-ink-muted">
              <th className="px-5 py-3.5 font-bold">Document</th>
              <th className="px-4 py-3.5 font-bold">Classification</th>
              <th className="px-4 py-3.5 font-bold">PQC Broadcast Encryption</th>
              <th className="px-4 py-3.5 font-bold">Created</th>
              <th className="px-5 py-3.5 text-right font-bold">Decryptions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {assets.map((a) => (
              <tr
                key={a.assetId}
                className="transition hover:bg-line/30"
              >
                <td className="px-5 py-4 font-bold text-ink text-sm">{a.title}</td>
                <td className="px-4 py-4">
                  <ClassificationBadge value={a.classification} />
                </td>
                <td className="px-4 py-4">
                  <span className="pill !bg-emerald-50 !text-emerald-700 text-xs font-semibold whitespace-nowrap">
                    {a.encapsulationCount ?? a.authorizedUserIds?.length ?? 0} Recipients (ML-KEM-768)
                  </span>
                </td>
                <td className="mono px-4 py-4 text-xs text-ink-muted whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleString()}
                </td>
                <td className="mono px-5 py-4 text-right font-extrabold text-sm text-ink">{a.decryptCount}</td>
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
    <span className={`pill text-xs font-bold shrink-0 ${CLASS_STYLE[value] || 'bg-line text-ink-muted'}`}>
      {value}
    </span>
  );
}

/* -- shared building blocks reused across the other screens ----------------- */

export function Header({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-display text-2xl sm:text-[28px] font-extrabold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-ink-muted">{subtitle}</p>}
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
