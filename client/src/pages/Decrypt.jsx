import { useEffect, useState } from 'react';
import { getAssets, getUsers, decryptAsset, markedFileUrl, shortHash } from '../lib/api.js';
import { Header, Notice } from './Assets.jsx';
import { useAuth } from '../lib/auth.jsx';

/**
 * Pick a document, an officer and a device, then release a watermarked copy.
 * The chain receipt is written before the mark is embedded (see the backend
 * orchestration), so a marked copy can never exist without a receipt.
 */
export default function Decrypt() {
  const { user, can } = useAuth();
  // Only an administrator may release a copy in someone else's name. For an
  // officer the field is not a choice at all, so it is not rendered as one —
  // /api/users returns only themselves, and the API refuses any other id.
  const mayChooseOfficer = can('decrypt:any');

  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ assetId: '', userId: '', deviceLabel: 'DESK-114' });
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getAssets(), getUsers()])
      .then(([a, u]) => {
        setAssets(a.assets);
        setUsers(u.users);
        setForm((f) => ({
          ...f,
          assetId: String(a.assets[0]?.assetId ?? ''),
          // Default to yourself when you are in the list at all.
          userId: String(
            u.users.find((x) => x.userId === user?.userId)?.userId ?? u.users[0]?.userId ?? ''
          ),
        }));
      })
      .catch((e) => setError(e.message));
  }, [user?.userId]);

  const officer = users.find((u) => String(u.userId) === form.userId);
  const asset = assets.find((a) => String(a.assetId) === form.assetId);

  async function submit(e) {
    e.preventDefault();
    setStatus('working');
    setError(null);
    setResult(null);
    try {
      const r = await decryptAsset({
        assetId: Number(form.assetId),
        userId: Number(form.userId),
        deviceLabel: form.deviceLabel || 'UNKNOWN-DEVICE',
      });
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
        title="Decrypt a document"
        subtitle="Releasing a copy writes an immutable receipt on-chain, then embeds an invisible Haar-DWT watermark before the file leaves the system."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* form */}
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

          <button type="submit" className="btn-lime w-full" disabled={status === 'working'}>
            {status === 'working'
              ? 'Embedding invisible mark (Haar DWT)…'
              : 'Decrypt & release copy'}
          </button>

          {error && <Notice tone="error">{error}</Notice>}
        </form>

        {/* result */}
        <div className="lg:col-span-3">
          {status === 'idle' && (
            <Notice>Choose a document and an officer, then release a watermarked copy.</Notice>
          )}
          {status === 'working' && (
            <div className="card grid place-items-center p-10 text-center">
              <div className="mono animate-pulse text-sm text-ink-muted">
                Writing on-chain receipt, then embedding the mark…
              </div>
            </div>
          )}
          {status === 'done' && result && (
            <Receipt result={result} officer={officer} asset={asset} device={form.deviceLabel} />
          )}
        </div>
      </div>
    </section>
  );
}

function Receipt({ result, officer, asset, device }) {
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
          <ChainRow k="tx hash" v={shortHash(result.txHash, 10, 6)} />
          <ChainRow k="block" v={result.blockNumber ?? '—'} />
          <ChainRow k="payload" v={`${result.payloadBits?.length ?? 0} bits embedded`} />
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
      </div>

      {/* registry group — light, real identity */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-bold text-ink">Internal registry</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Reg k="Officer" v={officer?.name} />
          <Reg k="Department" v={officer?.dept} />
          <Reg k="Document" v={asset?.title} />
          <Reg k="Device" v={device} />
          <Reg k="PSNR" v={result.psnrDb != null ? `${result.psnrDb.toFixed(1)} dB` : '—'} />
          <Reg k="QIM strength" v={`Δ = ${result.deltaUsed}`} />
        </dl>
        <a href={markedFileUrl(result.downloadUrl)} className="btn-dark mt-5 w-full" download>
          Download watermarked copy
        </a>
      </div>
    </div>
  );
}

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
