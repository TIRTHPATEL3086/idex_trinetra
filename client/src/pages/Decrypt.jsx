import { useEffect, useState, useCallback } from 'react';
import {
  getAssets,
  getUsers,
  decryptAsset,
  getPqcKeyBundle,
  requestDecryptChallenge,
  markedFileUrl,
  shortHash,
} from '../lib/api.js';
import { unlockAndSign } from '../lib/pqc.js';
import { Header, Notice } from './Assets.jsx';
import { useAuth } from '../lib/auth.jsx';

/**
 * Pick a document, an officer and a device, then release a watermarked copy.
 * The chain receipt is written before the mark is embedded (see the backend
 * orchestration), so a marked copy can never exist without a receipt.
 *
 * Phase 2 — True Non-Repudiation:
 *   If the officer has enrolled PQC keys and provides a passphrase, the
 *   client unlocks their ML-DSA-65 private key locally (scrypt + AES-GCM in
 *   the browser), signs a server-issued challenge, and passes the signature to
 *   the server. The private key NEVER leaves the browser.
 */
export default function Decrypt() {
  const { user, can } = useAuth();
  const mayChooseOfficer = can('decrypt:any');

  const [assets, setAssets] = useState([]);
  const [users, setUsers]   = useState([]);
  const [form, setForm]     = useState({ assetId: '', userId: '', deviceLabel: 'DESK-114', passphrase: '' });

  // idle | signing | working | done | error
  const [status, setStatus]       = useState('idle');
  const [sigStatus, setSigStatus] = useState(null); // null | 'signing' | 'ok' | 'skipped'
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [showPass, setShowPass]   = useState(false);

  useEffect(() => {
    Promise.all([getAssets(), getUsers()])
      .then(([a, u]) => {
        setAssets(a.assets);
        setUsers(u.users);
        setForm((f) => ({
          ...f,
          assetId: String(a.assets[0]?.assetId ?? ''),
          userId: String(
            u.users.find((x) => x.userId === user?.userId)?.userId ?? u.users[0]?.userId ?? ''
          ),
        }));
      })
      .catch((e) => setError(e.message));
  }, [user?.userId]);

  const officer = users.find((u) => String(u.userId) === form.userId);
  const asset   = assets.find((a) => String(a.assetId) === form.assetId);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    setSigStatus(null);
    setError(null);
    setResult(null);

    const assetId = Number(form.assetId);
    const userId  = Number(form.userId);

    let clientSignature = undefined;
    let challengeId     = undefined;

    // ── Phase 2: Client-Side ML-DSA-65 Non-Repudiation ──────────────────────
    // Only attempt if the officer provides a passphrase. The encrypted bundle
    // is fetched from /api/keys/bundle (owner-only endpoint). The private key
    // is unlocked and signs a one-time server challenge entirely in the browser.
    if (form.passphrase) {
      try {
        setSigStatus('signing');
        setStatus('signing');

        // 1. Fetch encrypted key bundle for the logged-in user
        const bundleRes = await getPqcKeyBundle();

        if (bundleRes?.encryptedPqcKeys) {
          // 2. Get a one-time signing challenge from the server
          const challenge = await requestDecryptChallenge({ assetId, userId });

          // 3. Unlock private key bundle + sign challenge — entirely in browser
          const sig = await unlockAndSign(
            bundleRes.encryptedPqcKeys,
            form.passphrase,
            challenge.challengeHex
          );

          clientSignature = sig;
          challengeId     = challenge.challengeId;
          setSigStatus('ok');
        } else {
          // Officer not enrolled — skip client-side signing gracefully
          setSigStatus('skipped');
        }
      } catch (sigErr) {
        // Signing failed (wrong passphrase / not enrolled) — continue without
        // client sig; server will attempt server-side signing from stored keys
        console.warn('[pqc] Client signing skipped:', sigErr.message);
        setSigStatus('skipped');
      }
    }

    // ── Decrypt + watermark + on-chain anchor ────────────────────────────────
    setStatus('working');
    try {
      const r = await decryptAsset({
        assetId,
        userId,
        deviceLabel: form.deviceLabel || 'UNKNOWN-DEVICE',
        passphrase:  form.passphrase || undefined,
        clientSignature,
        challengeId,
      });
      setResult(r);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [form]);

  const isBusy = status === 'working' || status === 'signing';

  return (
    <section className="space-y-6">
      <Header
        title="Decrypt a document"
        subtitle="Releasing a copy writes an immutable receipt on-chain, then embeds an invisible Haar-DWT watermark before the file leaves the system."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Form ─────────────────────────────────────────────────────── */}
        <form onSubmit={submit} className="card space-y-4 p-5 lg:col-span-2">
          <Field label="Document">
            <select
              className="input"
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            >
              {assets.map((a) => (
                <option key={a.assetId} value={a.assetId}>
                  {a.title} · {a.classification}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Officer">
            {mayChooseOfficer ? (
              <select
                className="input"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              >
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name} · {u.dept}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-xl border border-line bg-[#fbfbf7] px-3.5 py-2.5">
                <div className="text-sm font-bold text-ink">{user?.name}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                  {user?.dept} · the copy is watermarked with your identity, so it can only be
                  released in your name.
                </div>
              </div>
            )}
          </Field>

          <Field label="Device label">
            <input
              className="input"
              value={form.deviceLabel}
              onChange={(e) => setForm({ ...form, deviceLabel: e.target.value })}
              placeholder="DESK-114"
            />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-ink">
                Key Passphrase (for client-side PQC signing)
              </label>
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="text-[11px] font-medium text-ink-muted hover:text-ink"
              >
                {showPass ? 'Hide 👁️' : 'Show 👁️'}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input pr-10"
                value={form.passphrase || ''}
                onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
                placeholder="Passphrase unlocks ML-DSA-65 private key locally"
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
              <span className="text-ink-faint">
                Decrypted <strong>only in browser</strong>. Leave blank for server-side signing.
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, passphrase: 'officer123' })}
                  className="rounded-md border border-edge bg-[#fbfbf7] px-2 py-0.5 text-[10px] font-medium text-ink hover:border-lime-500 hover:text-lime-700"
                >
                  Fill Default (<span className="mono">officer123</span>)
                </button>
                {form.passphrase && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, passphrase: '' })}
                    className="text-[10px] text-ink-muted hover:text-rose-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* PQC signing status chip */}
          {sigStatus && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                sigStatus === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : sigStatus === 'signing'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {sigStatus === 'ok'
                ? '✓ ML-DSA-65 signature generated in browser'
                : sigStatus === 'signing'
                ? '⟳ Unlocking PQC key bundle…'
                : '⚠ Client signing skipped — server will sign'}
            </div>
          )}

          <button type="submit" className="btn-lime w-full" disabled={isBusy}>
            {status === 'signing'
              ? 'Generating non-repudiation signature…'
              : status === 'working'
              ? 'Embedding invisible mark (Haar DWT)…'
              : 'Decrypt & release copy'}
          </button>

          {error && <Notice tone="error">{error}</Notice>}
        </form>

        {/* ── Result panel ─────────────────────────────────────────────── */}
        <div className="lg:col-span-3">
          {status === 'idle' && (
            <Notice>Choose a document and an officer, then release a watermarked copy.</Notice>
          )}
          {isBusy && (
            <div className="card grid place-items-center p-10 text-center space-y-3">
              <div className="mono animate-pulse text-sm text-ink-muted">
                {status === 'signing'
                  ? 'Deriving scrypt key from passphrase… signing with ML-DSA-65…'
                  : 'Writing on-chain receipt, then embedding the Haar-DWT mark…'}
              </div>
              <PqcProgressBadge sigStatus={sigStatus} />
            </div>
          )}
          {status === 'done' && result && (
            <Receipt
              result={result}
              officer={officer}
              asset={asset}
              device={form.deviceLabel}
              sigStatus={sigStatus}
            />
          )}
        </div>
      </div>
    </section>
  );
}

// ─── PQC Progress Badge ──────────────────────────────────────────────────────
function PqcProgressBadge({ sigStatus }) {
  if (!sigStatus) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-emerald-700">
      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      {sigStatus === 'ok'
        ? 'ML-DSA-65 client signature ready'
        : sigStatus === 'signing'
        ? 'Performing post-quantum signing in browser…'
        : 'Using server-side signing fallback'}
    </div>
  );
}

// ─── Receipt ─────────────────────────────────────────────────────────────────
function Receipt({ result, officer, asset, device, sigStatus }) {
  const clientSigned = sigStatus === 'ok';
  return (
    <div className="space-y-4">
      {/* on-chain group — dark, hashed */}
      <div className="rounded-3xl bg-night bg-gradient-to-br from-[#20220f] to-night p-5 text-white shadow-panel">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">On-chain receipt</h3>
          <span className="pill bg-lime text-night">verified</span>
        </div>
        <dl className="mono space-y-2 text-xs">
          <ChainRow k="receipt id" v={shortHash(result.receiptId, 10, 6)} />
          <ChainRow k="tx hash"    v={shortHash(result.txHash, 10, 6)} />
          <ChainRow k="block"      v={result.blockNumber ?? '—'} />
          <ChainRow k="payload"    v={`${result.payloadBits?.length ?? 0} bits embedded`} />
          {result.pqc?.signatureCommit && (
            <ChainRow k="sig commit" v={shortHash(result.pqc.signatureCommit, 10, 6)} />
          )}
        </dl>
        {result.etherscanUrl && (
          <a
            href={result.etherscanUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            View on Etherscan ↗
          </a>
        )}

        {/* PQC status inside receipt */}
        {result.pqc && (
          <div className="mt-4 border-t border-white/10 pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-400">
                NIST Post-Quantum Cryptography
              </span>
              <div className="flex items-center gap-1.5">
                {clientSigned && (
                  <span className="rounded bg-blue-500/30 px-2 py-0.5 text-[9px] font-bold text-blue-300 uppercase">
                    Browser-Signed
                  </span>
                )}
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {result.pqc.dsaAlgorithm ?? 'ML-DSA-65'}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-white/70">
              Content key decrypted via{' '}
              <span className="font-semibold text-white">{result.pqc.kemAlgorithm}</span>.
            </div>
            {result.pqc.signatureCommit && (
              <div className="rounded-lg bg-black/30 p-2 font-mono text-[10px] text-white/80 space-y-1">
                <div className="text-white/50 uppercase text-[9px] font-sans font-bold">
                  On-chain Signature Commit (FIPS 204)
                </div>
                <div className="break-all text-lime">{result.pqc.signatureCommit}</div>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>
                {clientSigned
                  ? 'Non-repudiation locked via true client-side signing (key never left browser)'
                  : 'Non-repudiation cryptographic binding locked on ledger'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* registry group — light, real identity */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-bold text-ink">Internal registry</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Reg k="Officer"      v={officer?.name} />
          <Reg k="Department"   v={officer?.dept} />
          <Reg k="Document"     v={asset?.title} />
          <Reg k="Device"       v={device} />
          <Reg k="PSNR"         v={result.psnrDb != null ? `${result.psnrDb.toFixed(1)} dB` : '—'} />
          <Reg k="QIM strength" v={`Δ = ${result.deltaUsed}`} />
        </dl>
        <a href={markedFileUrl(result.downloadUrl)} className="btn-dark mt-5 w-full" download>
          Download watermarked copy
        </a>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function ChainRow({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/50">{k}</dt>
      <dd className="text-white">{v}</dd>
    </div>
  );
}
function Reg({ k, v }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{k}</dt>
      <dd className="mt-0.5 font-bold text-ink">{v ?? '—'}</dd>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
