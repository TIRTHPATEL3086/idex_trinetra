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
    blurb: 'A confident match. The evidence points to one officer.',
  },
  PROBABLE: {
    label: 'Probable',
    ring: 'ring-probable',
    text: 'text-probable',
    chip: 'bg-probable/10 text-probable',
    blurb: 'A lead, not a conclusion. Treat as a candidate to investigate.',
  },
  INCONCLUSIVE: {
    label: 'Inconclusive',
    ring: 'ring-inconclusive',
    text: 'text-inconclusive',
    chip: 'bg-inconclusive/10 text-inconclusive',
    blurb: 'Below the threshold. The system does not name anyone here.',
  },
};

function Verdict({ result }) {
  const band = BAND[result.verdict] || BAND.INCONCLUSIVE;
  const pct = Math.round((result.confidence || 0) * 100);

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

      {/* match + reasons */}
      <div className="space-y-5 lg:col-span-2">
        {result.match ? (
          <div className="rounded-3xl bg-night bg-gradient-to-br from-[#20220f] to-night p-5 text-white shadow-panel">
            <h3 className="mb-3 text-sm font-bold">Matched release</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Mt k="Officer" v={result.match.userName} />
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
          </div>
        ) : (
          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink">No name returned</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Confidence is below the reporting threshold, so no officer is named. That is the
              system working as intended — it does not guess.
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
