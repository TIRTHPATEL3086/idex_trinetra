import { useCallback, useEffect, useRef, useState } from 'react';
import { getAssets, uploadAsset, getUsers, revealAllotment } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { CheckIcon, CloseIcon, CopyIcon, EyeIcon, EyeOffIcon } from '../components/icons.jsx';
import Select from '../components/Select.jsx';

/**
 * The document register.
 *
 * Responsive: dark overview panel of stat tiles, then a table (sm+) or a
 * stacked card list (mobile). Nothing overflows horizontally at 320px.
 */
export default function Assets() {
  const { user, can } = useAuth();
  const mayUpload = can('assets:upload');

  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedInitialFile, setDroppedInitialFile] = useState(null);
  const [pageDragging, setPageDragging] = useState(false);
  const [classificationFilter, setClassificationFilter] = useState('ALL');

  const reload = useCallback(() => {
    getAssets()
      .then((d) => setAssets(d.assets))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Documents assigned to the individual officer (or all documents for admin)
  const officerAssets = assets
    ? user?.role === 'OFFICER'
      ? assets.filter((a) => a.authorizedUserIds?.includes(user.userId))
      : assets
    : [];

  const filteredAssets =
    classificationFilter === 'ALL'
      ? officerAssets
      : officerAssets.filter((a) => a.classification === classificationFilter);

  return (
    <section className="space-y-6">
      <Header
        eyebrow="Registry"
        title="Protected documents"
        action={
          mayUpload ? (
            <button
              type="button"
              className="btn-accent"
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
              ? 'border-accent-deep bg-accent/20 scale-[1.01] shadow-lg ring-4 ring-accent/30'
              : 'border-line/80 bg-gradient-to-r from-surface to-white hover:border-accent-deep hover:bg-accent/5'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-noir shadow-sm">
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

      {!error && assets && <Overview assets={officerAssets} />}

      {!error && officerAssets.length === 0 && (
        <Notice>
          {mayUpload
            ? 'No documents yet. Upload one to begin.'
            : 'No documents assigned to your clearance yet. An administrator assigns them.'}
        </Notice>
      )}

      {!error && filteredAssets.length === 0 && officerAssets.length > 0 && (
        <Notice>
          No documents found with classification &ldquo;{classificationFilter}&rdquo;.
        </Notice>
      )}

      {!error && officerAssets.length > 0 && (
        <DocumentList
          assets={filteredAssets}
          user={user}
          classificationFilter={classificationFilter}
          setClassificationFilter={setClassificationFilter}
        />
      )}

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
        Document PDF or Image <span className="text-danger">*</span>
      </span>
      {file ? (
        <div className="flex items-center justify-between rounded-2xl border-2 border-accent/60 bg-accent/10 p-3.5 transition">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-noir text-accent font-extrabold text-xs">
              {file.name.endsWith('.pdf') ? 'PDF' : 'IMG'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-ink">{file.name}</div>
              <div className="text-[11px] text-ink-muted">
                {formatBytes(file.size)} · Ready to encrypt
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="rounded-lg p-1.5 text-xs text-ink-muted hover:bg-white hover:text-danger-deep transition"
            title="Remove file"
          >
            <CloseIcon size={14} />
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
              ? 'border-accent-deep bg-accent/15 scale-[1.01] shadow-inner'
              : 'border-line hover:border-accent-deep bg-surface hover:bg-accent/5'
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
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-accent text-noir mb-2 shadow-sm">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
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
  const [title, setTitle] = useState(initialFile ? initialFile.name.replace(/\.[^/.]+$/, '') : '');
  const [classification, setClassification] = useState('CONFIDENTIAL');
  const [file, setFile] = useState(initialFile || null);
  const [status, setStatus] = useState('idle'); // idle | working | error
  const [error, setError] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  useEffect(() => {
    getUsers()
      .then((data) => {
        const eligible = (data.users || []).filter((u) => u.active && u.role === 'OFFICER');
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
      className="fixed inset-0 z-50 grid place-items-center bg-noir/40 p-4 backdrop-blur-sm"
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
            <CloseIcon size={14} />
          </button>
        </div>
        <p className="text-sm text-ink-muted">
          The file is SHA-256 hashed and encrypted with AES-256-GCM. The content key is encapsulated
          using NIST ML-KEM-768 for each authorized recipient.
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
          <Select
            ariaLabel="Classification"
            value={classification}
            onChange={setClassification}
            options={[
              { value: 'RESTRICTED', label: 'RESTRICTED' },
              { value: 'CONFIDENTIAL', label: 'CONFIDENTIAL' },
              { value: 'SECRET', label: 'SECRET' },
            ]}
          />
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
              <span className="text-[11px] text-accent-deep font-semibold">
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
                        className="rounded text-accent-deep focus:ring-accent"
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
            className="btn-accent flex-1"
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
  const secret = assets.filter((a) => a.classification === 'SECRET').length;
  const decryptions = assets.reduce((sum, a) => sum + (a.decryptCount || 0), 0);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-noir p-6 text-white shadow-panel sm:p-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Registry overview
          </div>
          <div className="font-display mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
            {documents} <span className="text-white/40 font-normal">protected documents</span>
          </div>
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
        highlight ? 'bg-accent text-noir shadow-md' : 'bg-noir-soft text-white'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${
            highlight ? 'text-noir/80' : 'text-white/60'
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

function DocumentList({ assets, user, classificationFilter, setClassificationFilter }) {
  // The passphrase column is for the person the copy was released to. An
  // administrator sets these when dispatching, so repeating them against every
  // document here is noise — and one more place a clearance secret can sit on
  // an unattended screen. An investigator cannot decrypt, so has no use for one.
  const showPassphrase = user?.role === 'OFFICER';
  return (
    <div className="space-y-3">
      {/* Classification filter header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          {user?.role === 'OFFICER'
            ? `Assigned Documents (${assets.length})`
            : `All Documents (${assets.length})`}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="classification-select" className="text-xs font-semibold text-ink-muted">
            Classification:
          </label>
          <Select
            className="w-52"
            ariaLabel="Filter by classification"
            buttonClassName="!py-1.5 !text-xs !font-semibold"
            value={classificationFilter}
            onChange={setClassificationFilter}
            options={[
              { value: 'ALL', label: 'All Classifications' },
              { value: 'RESTRICTED', label: 'RESTRICTED' },
              { value: 'CONFIDENTIAL', label: 'CONFIDENTIAL' },
              { value: 'SECRET', label: 'SECRET' },
            ]}
          />
        </div>
      </div>

      {/* Cards — mobile only. */}
      <ul className="space-y-3 sm:hidden">
        {assets.map((a) => (
          <li key={a.assetId} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-ink text-sm">{a.title}</div>
              <ClassificationBadge value={a.classification} />
            </div>
            <div className="text-xs text-ink-muted">
              <span className="pill !bg-attributed-tint !text-attributed-deep text-xs font-semibold">
                {a.encapsulationCount ?? a.authorizedUserIds?.length ?? 0} Recipients (ML-KEM-768)
              </span>
            </div>
            <dl className="mono grid grid-cols-2 gap-y-1.5 text-xs text-ink-muted pt-2 border-t border-line/60">
              <dt>Created</dt>
              <dd className="text-right text-ink font-semibold">
                {new Date(a.createdAt).toLocaleDateString()}
              </dd>
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
            <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wider text-ink-muted">
              <th className="px-5 py-3.5 font-bold">Document</th>
              <th className="px-4 py-3.5 font-bold">Classification</th>
              {showPassphrase && (
                <th className="px-4 py-3.5 font-bold">PQC Broadcast Encryption</th>
              )}
              <th className="px-4 py-3.5 font-bold">Created</th>
              <th className="px-5 py-3.5 text-right font-bold">Decryptions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {assets.map((a) => (
              <tr key={a.assetId} className="transition hover:bg-line/30">
                <td className="px-5 py-4 font-bold text-ink text-sm">{a.title}</td>
                <td className="px-4 py-4">
                  <ClassificationBadge value={a.classification} />
                </td>
                {showPassphrase && (
                  <td className="px-4 py-4">
                    <PassphraseCell asset={a} />
                  </td>
                )}
                <td className="mono px-4 py-4 text-xs text-ink-muted whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleString()}
                </td>
                <td className="mono px-5 py-4 text-right font-extrabold text-sm text-ink">
                  {a.decryptCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The recipient passphrase for a document, kept masked until its owner proves
 * they are still at the keyboard.
 *
 * The dots are not a rendered secret behind a CSS mask — nothing is fetched
 * until the password check passes, so the value is never in the page for a
 * screenshot or the dev tools to pick up. Revealing re-locks on unmount and
 * can be re-locked by hand, because leaving a clearance secret on screen is
 * the same exposure as never masking it.
 */
function PassphraseCell({ asset }) {
  const [stage, setStage] = useState('locked'); // locked | asking | shown
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function unlock(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await revealAllotment(asset.assetId, password);
      setSecret(r.passphrase || '');
      setStage('shown');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Could not verify that password.');
    } finally {
      setBusy(false);
    }
  }

  function relock() {
    setSecret('');
    setStage('locked');
    setError(null);
  }

  function copy() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (stage === 'shown' && !secret) {
    return (
      <span className="text-xs font-semibold text-ink-muted">
        None allotted — use your account password
      </span>
    );
  }

  if (stage === 'shown') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="mono rounded-lg bg-accent-tint px-2.5 py-1 text-xs font-semibold text-ink">
          {secret}
        </span>
        <button
          type="button"
          onClick={copy}
          title="Copy passphrase"
          className="btn-icon !h-7 !w-7"
          aria-label="Copy passphrase"
        >
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
        </button>
        <button
          type="button"
          onClick={relock}
          title="Hide again"
          className="btn-icon !h-7 !w-7"
          aria-label="Hide passphrase"
        >
          <EyeOffIcon size={12} />
        </button>
      </div>
    );
  }

  if (stage === 'asking') {
    return (
      <form onSubmit={unlock} className="flex items-center gap-1.5">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your login password"
          aria-label="Your login password"
          className="input !w-44 !py-1.5 text-xs"
        />
        <button type="submit" className="btn-accent !px-3 !py-1.5 !text-xs" disabled={busy}>
          {busy ? '…' : 'Unlock'}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage('locked');
            setPassword('');
            setError(null);
          }}
          className="btn-icon !h-7 !w-7"
          aria-label="Cancel"
        >
          <CloseIcon size={12} />
        </button>
        {error && <span className="text-[11px] font-semibold text-danger-deep">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="mono select-none text-sm tracking-[0.2em] text-ink-faint" aria-hidden="true">
        ••••••••••
      </span>
      <button
        type="button"
        onClick={() => setStage('asking')}
        title="Reveal passphrase"
        className="btn-icon !h-7 !w-7"
        aria-label="Reveal passphrase"
      >
        <EyeIcon size={12} />
      </button>
    </div>
  );
}

const CLASS_STYLE = {
  RESTRICTED: 'bg-line text-ink-muted',
  CONFIDENTIAL: 'bg-accent text-noir',
  SECRET: 'bg-noir text-white',
};

function ClassificationBadge({ value }) {
  return (
    <span
      className={`pill text-xs font-bold shrink-0 ${CLASS_STYLE[value] || 'bg-line text-ink-muted'}`}
    >
      {value}
    </span>
  );
}

/* -- shared building blocks reused across the other screens ----------------- */

/**
 * Page header. The reference leads each section with a small uppercase eyebrow
 * over a large, tightly-tracked display line, then rules it off — that rhythm
 * is what makes its pages feel composed rather than stacked.
 */
export function Header({ title, subtitle, action, eyebrow }) {
  return (
    <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2.5">{eyebrow}</div>}
        <h2 className="font-display text-[28px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[34px]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Notice({ children, tone = 'default' }) {
  const styles =
    tone === 'error'
      ? 'border-danger-bright bg-danger-tint text-danger-deep'
      : 'border-line bg-white text-ink-muted';
  return <div className={`rounded-3xl border px-5 py-4 text-sm ${styles}`}>{children}</div>;
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
        stroke={highlight ? '#0f151d' : '#fff'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
