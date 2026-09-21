import { useRef, useState } from 'react';
import { traceFile, shortHash } from '../lib/api.js';
import { Header, Notice } from './Assets.jsx';

/**
 * Upload a leaked file; the register returns a confidence band, never a bare
 * accusation. Below the threshold the match is withheld and the screen says so.
 */
export default function Trace() {
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

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
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  return (
    <section className="space-y-6">
      <Header
        title="Trace a leaked file"
        subtitle="The watermark says which receipt; the perceptual hashes say which file; the chain confirms both. The result is a confidence band, never a bare accusation."
      />

      {/* dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          run(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className="card grid cursor-pointer place-items-center border-2 border-dashed border-line px-6 py-10 text-center transition hover:border-lime-deep"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => run(e.target.files?.[0])}
        />
        <div className="grid h-12 w-12 place-items-center rounded-full bg-lime">
          <UploadGlyph />
        </div>
        <div className="mt-3 font-bold text-ink">
          {fileName ? fileName : 'Drop a suspected leaked image, or click to browse'}
        </div>
        <div className="mt-1 text-xs text-ink-muted">
          It will be hashed, matched, and the watermark extracted — nothing is stored as plaintext.
        </div>
      </div>

      {status === 'working' && (
        <div className="card grid place-items-center p-8 text-center">
          <div className="mono animate-pulse text-sm text-ink-muted">
            Hashing → searching the register → extracting the watermark → cross-checking the chain…
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {status === 'done' && result && <Verdict result={result} />}
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
    <div className="grid gap-5 lg:grid-cols-3">
      {/* verdict + ring */}
      <div className="card flex flex-col items-center justify-center p-6 text-center">
        <div
          className={`grid h-32 w-32 place-items-center rounded-full ring-8 ${band.ring} ring-offset-4`}
        >
          <div>
            <div className={`text-3xl font-extrabold ${band.text}`}>{pct}%</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              confidence
            </div>
          </div>
        </div>
        <div className={`pill mt-4 ${band.chip}`}>{band.label}</div>
        <p className="mt-3 max-w-[15rem] text-xs text-ink-muted">{band.blurb}</p>
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
          </div>
        ) : showSuspectPool ? (
          <div className="card border-2 border-amber-300/40 bg-amber-500/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-amber-500 animate-ping" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-700">
                  Suspect Pool (शक के दायरे में अधिकारी) — 30%–60% Range
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
                    <span className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] font-semibold text-amber-800">
                      Interrogate
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink">No name returned</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Confidence is below the 30% reporting threshold, so no officer is named. That is the
              system working as intended — it avoids false accusations when the watermark is completely destroyed.
            </p>
          </div>
        )}

        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-ink">Why</h3>
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
