import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { traceFile, getInvestigations, shortHash } from '../lib/api.js';
import { Header, Notice } from './Assets.jsx';

/**
 * Upload a leaked file; the register returns a confidence band, never a bare
 * accusation. Below the threshold the match is withheld and the screen says so.
 * Every investigation produces a court-admissible Forensic Evidence Dossier (PDF).
 */
export default function Trace() {
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [investigations, setInvestigations] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [timeRange, setTimeRange] = useState('all'); // 'all' | '7d' | '30d' | '1y'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'confidence-desc' | 'confidence-asc' | 'verdict'
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await getInvestigations();
      setInvestigations(data.investigations || []);
    } catch {
      // Non-fatal
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredAndSorted = useMemo(() => {
    let list = [...investigations];

    // Time filter
    const now = Date.now();
    if (timeRange === '7d') {
      const cut = now - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((x) => new Date(x.createdAt).getTime() >= cut);
    } else if (timeRange === '30d') {
      const cut = now - 30 * 24 * 60 * 60 * 1000;
      list = list.filter((x) => new Date(x.createdAt).getTime() >= cut);
    } else if (timeRange === '1y') {
      const cut = now - 365 * 24 * 60 * 60 * 1000;
      list = list.filter((x) => new Date(x.createdAt).getTime() >= cut);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((x) => {
        const idStr = `INV-${String(x.investigationId).padStart(5, '0')}`.toLowerCase();
        const vStr = (x.verdict || '').toLowerCase();
        const dateStr = new Date(x.createdAt).toLocaleString().toLowerCase();
        return idStr.includes(q) || vStr.includes(q) || dateStr.includes(q);
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'confidence-desc') return (b.confidence || 0) - (a.confidence || 0);
      if (sortBy === 'confidence-asc') return (a.confidence || 0) - (b.confidence || 0);
      if (sortBy === 'verdict') return (a.verdict || '').localeCompare(b.verdict || '');
      return 0;
    });

    return list;
  }, [investigations, timeRange, sortBy, searchQuery]);

  async function run(file) {
    if (!file) return;
    setFileName(file.name);
    setStatus('working');
    setError(null);
    setResult(null);
    try {
      const r = await traceFile(file);
      setResult(r);
      setStatus('done');
      loadHistory(); // refresh history list
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  return (
    <section className="space-y-3.5">
      <Header
        title="Trace a leaked file"
        subtitle="The watermark says which receipt; the perceptual hashes say which file; the chain confirms both. Court-admissible forensic dossiers can be exported for any inquiry."
      />

      {/* dropzone with smooth drag & drop feedback */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          run(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`card grid cursor-pointer place-items-center border-2 border-dashed px-5 py-4 sm:py-5 text-center transition-all duration-200 ${
          isDragging
            ? 'border-lime-deep bg-lime/15 scale-[1.01] shadow-lg ring-4 ring-lime/30'
            : 'border-line hover:border-lime-deep hover:bg-lime/5'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => run(e.target.files?.[0])}
        />
        <div
          className={`grid h-10 w-10 place-items-center rounded-full bg-lime text-night transition-transform duration-200 shadow-sm ${
            isDragging ? 'scale-125' : ''
          }`}
        >
          <UploadGlyph />
        </div>
        <div className="mt-2 text-xs sm:text-sm font-bold text-ink">
          {isDragging
            ? 'Release to begin deep cryptographic trace!'
            : fileName
            ? fileName
            : 'Drop a suspected leaked image or PDF, or click to browse'}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-muted">
          It will be hashed, matched, and the watermark extracted — nothing is stored as plaintext.
        </div>
      </div>

      {status === 'working' && (
        <div className="card grid place-items-center p-6 text-center space-y-2">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-lime border-t-transparent" />
          <div className="mono animate-pulse text-xs text-ink-muted">
            Hashing → searching perceptual register → extracting watermark → cross-checking blockchain…
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {status === 'done' && result && <Verdict result={result} />}

      {/* Past Investigations and Dossier Archive */}
      <div className="card overflow-hidden p-0 shadow-sm">
        {/* Top Header */}
        <div className="border-b border-line px-5 py-3 sm:px-6 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-gradient-to-r from-white to-[#fbfbf7]">
          <div>
            <h3 className="text-sm font-bold text-ink">Forensic Investigation Dossiers</h3>
            <p className="text-[11px] text-ink-muted">
              Official cryptographic evidence dossiers generated for recent leak inquiries.
            </p>
          </div>
          <span className="text-[11px] font-mono text-ink-muted bg-night/5 px-2.5 py-0.5 rounded-full self-start md:self-auto font-bold">
            Showing {filteredAndSorted.length} of {investigations.length} Record(s)
          </span>
        </div>

        {/* Filters and Sorting Toolbar */}
        <div className="border-b border-line bg-slate-50/70 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Timeframe Filter Buttons (7 Days / 1 Month / 1 Year / All) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mr-0.5">
              Timeframe:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 1 Month' },
              { id: '1y', label: 'Last 1 Year' },
            ].map((t) => {
              const active = timeRange === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimeRange(t.id)}
                  className={`rounded-full px-2.5 py-0.5 font-bold text-[10px] sm:text-[11px] transition shadow-xs ${
                    active
                      ? 'bg-night text-lime shadow-sm ring-1 ring-lime/40'
                      : 'bg-white text-ink-muted border border-line hover:border-lime-deep hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Sort & Search Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-ink-faint">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input !h-7 !py-0.5 !text-xs font-semibold bg-white border-line shadow-xs rounded-xl"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="confidence-desc">Highest Confidence</option>
                <option value="confidence-asc">Lowest Confidence</option>
                <option value="verdict">By Verdict</option>
              </select>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dossiers…"
              className="input !h-7 !py-0.5 !text-xs w-36 sm:w-44 bg-white border-line rounded-xl"
            />

            {(timeRange !== 'all' || searchQuery || sortBy !== 'newest') && (
              <button
                type="button"
                onClick={() => {
                  setTimeRange('all');
                  setSortBy('newest');
                  setSearchQuery('');
                }}
                className="rounded-xl px-2 py-0.5 text-[10px] font-bold text-ink-muted hover:text-rose-600 hover:bg-rose-50 border border-line transition"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {loadingHistory ? (
          <div className="p-6 text-center text-xs text-ink-muted">Loading forensic dossiers…</div>
        ) : investigations.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-muted">
            No forensic investigations run yet. Upload a leaked document above to generate the first dossier.
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="p-8 text-center space-y-1.5">
            <div className="text-xs sm:text-sm font-bold text-ink">No dossiers match the selected filters</div>
            <p className="text-[11px] text-ink-muted">
              Try choosing a broader timeframe or resetting your search query.
            </p>
            <button
              type="button"
              onClick={() => {
                setTimeRange('all');
                setSearchQuery('');
                setSortBy('newest');
              }}
              className="btn-ghost !text-xs !py-1 !px-3 font-bold"
            >
              Show All Records
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[460px] scroll-slim">
            <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur-xs text-xs font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5">Inquiry ID</th>
                  <th className="px-4 py-2.5">Date / Timestamp</th>
                  <th className="px-4 py-2.5">Verdict</th>
                  <th className="px-4 py-2.5">Confidence</th>
                  <th className="px-4 py-2.5">Candidates Checked</th>
                  <th className="px-4 py-2.5 text-right">Evidence Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredAndSorted.map((inv) => {
                  const band = BAND[inv.verdict] || BAND.INCONCLUSIVE;
                  const pct = Math.round((inv.confidence || 0) * 100);

                  return (
                    <tr key={inv.investigationId} className="hover:bg-night/5 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-ink whitespace-nowrap">
                        INV-{String(inv.investigationId).padStart(5, '0')}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-muted font-mono whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`pill text-xs font-bold ${band.chip}`}>
                          {band.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-extrabold text-ink text-sm">
                        {pct}%
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted font-mono text-xs">
                        {inv.candidatesChecked ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <a
                          href={`/api/trace/${inv.investigationId}/dossier`}
                          download={`forensic-dossier-INV-${String(inv.investigationId).padStart(5, '0')}.pdf`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-lime-deep hover:bg-lime/20 transition shadow-xs"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="12" y1="18" x2="12" y2="12" />
                            <line x1="9" y1="15" x2="12" y2="18" />
                            <line x1="15" y1="15" x2="12" y2="18" />
                          </svg>
                          Export Dossier (PDF)
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const BAND = {
  ATTRIBUTED: {
    label: 'Attributed',
    ring: 'ring-attributed',
    text: 'text-attributed',
    chip: 'bg-attributed/10 text-attributed',
    blurb: 'A confident match (≥85%). Cryptographic & visual proof confirms the officer.',
  },
  PROBABLE: {
    label: 'Probable',
    ring: 'ring-probable',
    text: 'text-probable',
    chip: 'bg-probable/10 text-probable',
    blurb: 'High probability match (60%–84%). Officer identified with high confidence.',
  },
  SUSPICION: {
    label: 'Suspect Pool',
    ring: 'ring-amber-500',
    text: 'text-amber-600',
    chip: 'bg-amber-500/10 text-amber-600',
    blurb: 'Investigation window (30%–59%). Showing ranked suspect pool for inquiry.',
  },
  INCONCLUSIVE: {
    label: 'Inconclusive',
    ring: 'ring-inconclusive',
    text: 'text-inconclusive',
    chip: 'bg-inconclusive/10 text-inconclusive',
    blurb: 'Below the 30% threshold. Watermark destroyed or file is unrelated.',
  },
};

function Verdict({ result }) {
  const band = BAND[result.verdict] || BAND.INCONCLUSIVE;
  const pct = Math.round((result.confidence || 0) * 100);
  const showSuspectPool = !result.match && result.suspects && result.suspects.length > 0 && pct >= 30;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* verdict + ring */}
        <div className="card flex flex-col items-center justify-center p-6 text-center">
          <div
            className={`grid h-32 w-32 place-items-center rounded-full ring-8 ${band.ring} ring-offset-4`}
          >
            <div>
              <div className={`text-3xl sm:text-4xl font-extrabold ${band.text}`}>{pct}%</div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-muted mt-1">
                confidence
              </div>
            </div>
          </div>
          <div className={`pill text-xs font-bold mt-4 ${band.chip}`}>{band.label}</div>
          <p className="mt-3 max-w-[16rem] text-xs sm:text-sm text-ink-muted leading-relaxed">{band.blurb}</p>

          {/* Export Dossier Button directly on Verdict Card */}
          {result.investigationId && (
            <a
              href={`/api/trace/${result.investigationId}/dossier`}
              download={`forensic-dossier-INV-${result.investigationId}.pdf`}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-night shadow-sm hover:bg-lime/90 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="18" />
                <line x1="15" y1="15" x2="12" y2="18" />
              </svg>
              Export Dossier (PDF)
            </a>
          )}
        </div>

        {/* match + suspect pool + reasons */}
        <div className="space-y-5 lg:col-span-2">
          {result.match ? (
            <div className="rounded-3xl bg-night bg-gradient-to-br from-[#20220f] to-night p-5 text-white shadow-panel">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-lime">Matched release (Direct Attribution ≥60%)</h3>
                <span className="rounded-full bg-lime/20 px-2.5 py-0.5 text-[11px] font-bold text-lime">
                  OFFICER IDENTIFIED
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Mt k="Officer Name" v={result.match.userName} />
                <Mt k="Officer ID" v={`U-00${result.match.userId || '—'}`} />
                <Mt k="Department" v={result.match.department} />
                <Mt k="Document" v={result.match.assetTitle} />
                <Mt k="Device" v={result.match.deviceLabel} />
                <Mt k="Decrypted at" v={new Date(result.match.decryptedAt).toLocaleString()} />
                <Mt k="Tx" v={shortHash(result.match.txHash, 8, 6)} />
              </dl>
              {result.match.etherscanUrl && (
                <a
                  href={result.match.etherscanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                >
                  View on Etherscan ↗
                </a>
              )}

              {/* Post-Quantum Non-Repudiation Proof Card */}
              {result.match.pqcProof && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        NIST ML-DSA-65 Non-Repudiation Proof
                      </span>
                    </div>
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                      {result.match.pqcProof.signatureVerified ? 'CRYPTOGRAPHICALLY VERIFIED' : 'PENDING ENROLLMENT'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-white/70">
                    The recipient digitally signed this document release using their Post-Quantum private key (NIST FIPS 204). The signature is mathematically bound to the on-chain receipt — non-repudiation holds in a court of law.
                  </p>
                  <div className="mt-3 grid gap-2 rounded-xl bg-black/30 p-3 text-xs">
                    {result.match.pqcProof.signatureCommit && (
                      <div>
                        <span className="text-white/40">Signature Commit (On-Chain): </span>
                        <span className="mono text-lime font-medium">
                          {result.match.pqcProof.signatureCommit}
                        </span>
                      </div>
                    )}
                    {result.match.pqcProof.signatureHex && (
                      <div>
                        <span className="text-white/40">ML-DSA-65 Signature: </span>
                        <span className="mono text-white/80">
                          {result.match.pqcProof.signatureHex}
                        </span>
                      </div>
                    )}
                    {result.match.pqcProof.publicKeyHex && (
                      <div>
                        <span className="text-white/40">Officer PQC Public Key: </span>
                        <span className="mono text-white/80">
                          {result.match.pqcProof.publicKeyHex}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action bar inside matched panel */}
              {result.investigationId && (
                <div className="mt-5 border-t border-white/10 pt-4">
                  <a
                    href={`/api/trace/${result.investigationId}/dossier`}
                    download={`forensic-dossier-INV-${result.investigationId}.pdf`}
                    className="btn-dark w-full !bg-lime !text-night hover:!bg-lime/90 flex items-center justify-center gap-2 font-bold py-3 text-sm rounded-xl"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="12" y2="18" />
                      <line x1="15" y1="15" x2="12" y2="18" />
                    </svg>
                    Export Dossier (PDF)
                  </a>
                </div>
              )}
            </div>
          ) : showSuspectPool ? (
            <div className="card border-2 border-amber-300/40 bg-amber-500/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-amber-500 animate-ping" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-700">
                    Suspect Pool (30%–60% Range)
                  </h3>
                </div>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  {result.suspects.length} Officers Under Investigation
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                The uploaded file has suffered screenshot borders, crop, or compression noise. Single-person definitive attribution is held to prevent wrongful accusation. Based on <strong>watermark frequency correlation</strong> and <strong>decryption access chronology</strong>, the following officers fall inside the circle of suspicion:
              </p>

              <div className="mt-4 space-y-2.5">
                {result.suspects.map((s) => (
                  <div
                    key={s.rank}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/50 bg-white p-3.5 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-bold ${
                          s.suspicionLevel === 'HIGH'
                            ? 'bg-rose-500 text-white'
                            : s.suspicionLevel === 'MEDIUM'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-400 text-white'
                        }`}
                      >
                        #{s.rank}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink">{s.userName}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                            ID: U-00{s.userId}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              s.suspicionLevel === 'HIGH'
                                ? 'bg-rose-100 text-rose-700'
                                : s.suspicionLevel === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {s.suspicionLevel} SUSPICION
                          </span>
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {s.department || 'HQ'} · Device: <span className="font-mono">{s.deviceLabel || 'SECURE-NODE'}</span> · Decrypted: {new Date(s.decryptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-ink">{s.bitMatchPct}% Bit Match</div>
                        <div className="text-[10px] text-ink-muted">({s.bitsMatched}/{s.totalBits} bits)</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dossier button for suspect pool */}
              {result.investigationId && (
                <div className="mt-4 pt-4 border-t border-amber-200">
                  <a
                    href={`/api/trace/${result.investigationId}/dossier`}
                    download={`forensic-dossier-INV-${result.investigationId}.pdf`}
                    className="btn-dark w-full !bg-amber-500 !text-white hover:!bg-amber-600 flex items-center justify-center gap-2 font-bold py-2.5 text-xs rounded-xl"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="12" y2="18" />
                      <line x1="15" y1="15" x2="12" y2="18" />
                    </svg>
                    Export Dossier (PDF)
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-ink">No name returned</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Confidence is below the 30% reporting threshold, so no officer is named. That is the
                system working as intended — it avoids false accusations when the watermark is completely destroyed.
              </p>
              {result.investigationId && (
                <div className="mt-4 pt-3 border-t border-line">
                  <a
                    href={`/api/trace/${result.investigationId}/dossier`}
                    download={`forensic-dossier-INV-${result.investigationId}.pdf`}
                    className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-night/5 transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="12" y2="18" />
                      <line x1="15" y1="15" x2="12" y2="18" />
                    </svg>
                    Export Dossier (PDF)
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">Forensic Breakdown</h3>
            <ul className="space-y-2">
              {(result.reasons || []).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-deep" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <div className="mono mt-4 text-[11px] text-ink-faint">
              {result.candidatesChecked} candidates checked · {result.elapsedMs} ms
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mt({ k, v }) {
  return (
    <div>
      <dt className="text-xs text-white/50">{k}</dt>
      <dd className="mono mt-0.5 font-semibold text-white">{v ?? '—'}</dd>
    </div>
  );
}

function UploadGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0 4 4m-4-4L8 8M5 18h14"
        stroke="#141410"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
