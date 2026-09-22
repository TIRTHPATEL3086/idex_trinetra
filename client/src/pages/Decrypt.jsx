import { useEffect, useState, useCallback } from 'react';
import {
  getAssets,
  getUsers,
  decryptAsset,
  batchDecryptAsset,
  getPqcKeyBundle,
  requestDecryptChallenge,
  markedFileUrl,
  shortHash,
} from '../lib/api.js';
import { unlockAndSign } from '../lib/pqc.js';
import { Header, Notice } from './Assets.jsx';
import { useAuth } from '../lib/auth.jsx';
import {
  BanIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  LockIcon,
  SendIcon,
  UnlockIcon,
} from '../components/icons.jsx';

/**
 * Decrypt & Multi-Officer Dispatch.
 *
 * For Admin:
 *   - Multi-choice selection of recipient officers (checkboxes).
 *   - Common Passphrase or Individual Passphrase per officer.
 *   - Batch release & on-chain anchoring for all chosen recipients.
 *
 * For Officers:
 *   - Strictly locked to their own identity.
 *   - Must enter their allotted passphrase to decapsulate & release.
 *   - If the wrong passphrase is provided, decryption strictly FAILS and
 *     the watermarked file cannot be downloaded.
 */
export default function Decrypt() {
  const { user, can } = useAuth();
  const isAdmin = can('decrypt:any');

  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [deviceLabel, setDeviceLabel] = useState(isAdmin ? 'ADMIN-DISPATCH-01' : 'DESK-114');

  // Admin Multi-recipient state
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [passphraseMode, setPassphraseMode] = useState('common'); // 'common' | 'individual'
  const [commonPassphrase, setCommonPassphrase] = useState('');
  const [individualPassphrases, setIndividualPassphrases] = useState({});

  // Officer Single-recipient state
  const [officerPassphrase, setOfficerPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Status & Results
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [error, setError] = useState(null);
  const [singleResult, setSingleResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [sigStatus, setSigStatus] = useState(null); // null | 'signing' | 'ok' | 'skipped'
  useEffect(() => {
    Promise.all([getAssets(), getUsers()])
      .then(([a, u]) => {
        let availableAssets = a.assets || [];
        if (user?.role === 'OFFICER') {
          availableAssets = availableAssets.filter((x) =>
            x.authorizedUserIds?.includes(user.userId)
          );
        }
        setAssets(availableAssets);
        const uList = u.users || [];
        setUsers(uList);

        if (availableAssets[0]) {
          setAssetId(String(availableAssets[0].assetId));
        }

        // Default admin selection to all active officers
        if (isAdmin) {
          const officerIds = uList
            .filter((x) => x.role === 'OFFICER' && x.active)
            .map((x) => x.userId);
          setSelectedUserIds(officerIds);
        }
      })
      .catch((e) => setError(e.message));
  }, [isAdmin, user?.userId, user?.role]);

  const selectedAsset = assets.find((a) => String(a.assetId) === String(assetId));

  // Officer toggle helper for Admin
  const toggleUser = (uid) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const selectAllOfficers = () => {
    const officerIds = users.filter((x) => x.role === 'OFFICER' && x.active).map((x) => x.userId);
    setSelectedUserIds(officerIds);
  };

  const clearSelectedOfficers = () => {
    setSelectedUserIds([]);
  };

  const setOfficerIndivPass = (uid, val) => {
    setIndividualPassphrases((prev) => ({ ...prev, [uid]: val }));
  };

  // ─── ADMIN: Submit Batch Dispatch ─────────────────────────────────────────
  const submitAdminBatch = async (e) => {
    e.preventDefault();
    setError(null);
    setBatchResult(null);
    setSingleResult(null);

    if (selectedUserIds.length === 0) {
      setError('Please select at least one recipient officer to dispatch to.');
      return;
    }

    setStatus('working');
    try {
      const res = await batchDecryptAsset({
        assetId: Number(assetId),
        userIds: selectedUserIds,
        passphraseMode,
        commonPassphrase: commonPassphrase.trim() || 'officer123',
        individualPassphrases,
        deviceLabel: deviceLabel || 'ADMIN-DISPATCH-01',
      });
      setBatchResult(res);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Batch dispatch failed.');
      setStatus('error');
    }
  };

  // ─── OFFICER: Submit Single Decrypt with Allotted Passphrase ─────────────
  const submitOfficerDecrypt = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);
      setSingleResult(null);
      setSigStatus(null);

      if (!officerPassphrase.trim()) {
        setError('You must enter your allotted clearance passphrase to decrypt this document.');
        return;
      }

      const aId = Number(assetId);
      const uId = Number(user?.userId);

      let clientSignature = undefined;
      let challengeId = undefined;

      // Client-side PQC signing if enrolled
      try {
        setSigStatus('signing');
        const bundleRes = await getPqcKeyBundle();
        if (bundleRes?.encryptedPqcKeys) {
          const challenge = await requestDecryptChallenge({ assetId: aId, userId: uId });
          const sig = await unlockAndSign(
            bundleRes.encryptedPqcKeys,
            officerPassphrase.trim(),
            challenge.challengeHex
          );
          clientSignature = sig;
          challengeId = challenge.challengeId;
          setSigStatus('ok');
        } else {
          setSigStatus('skipped');
        }
      } catch (sigErr) {
        console.warn('[pqc] Client signing failed or incorrect passphrase:', sigErr.message);
        setError('Decryption passphrase incorrect or invalid key bundle.');
        setStatus('error');
        setSigStatus('error');
        return;
      }

      setStatus('working');
      try {
        const r = await decryptAsset({
          assetId: aId,
          userId: uId,
          deviceLabel: deviceLabel || 'DESK-114',
          passphrase: officerPassphrase.trim(),
          clientSignature,
          challengeId,
        });
        setSingleResult(r);
        setStatus('done');
      } catch (err) {
        setError(err.message || 'Decryption failed: invalid or unauthorized passphrase.');
        setStatus('error');
      }
    },
    [assetId, user?.userId, officerPassphrase, deviceLabel]
  );

  const isBusy = status === 'working';

  return (
    <section className="space-y-6">
      <Header
        eyebrow="Release"
        title={isAdmin ? 'Decrypt & Multi-Officer Dispatch' : 'Decrypt protected document'}
        subtitle={
          isAdmin
            ? 'Select a document, choose one or multiple recipient officers, and assign common or individual access passphrases.'
            : 'Enter your allotted clearance passphrase to decapsulate the content key and release your watermarked copy.'
        }
      />

      <div className="grid gap-6 xl:grid-cols-12">
        {/* ── Left Column: Form ────────────────────────────────────────── */}
        <div className="space-y-5 xl:col-span-6">
          <form
            onSubmit={isAdmin ? submitAdminBatch : submitOfficerDecrypt}
            className="card space-y-5 p-5 sm:p-6"
          >
            {/* Document Selection */}
            <Field label="Protected Document (PDF / Image)">
              <select
                className="input text-sm font-semibold"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                {assets.map((a) => (
                  <option key={a.assetId} value={a.assetId}>
                    {a.title} · [{a.classification}]
                  </option>
                ))}
              </select>
            </Field>

            {/* ── ADMIN: Multi-choice Officer Selection & Passphrase Modes ── */}
            {isAdmin ? (
              <div className="space-y-4 rounded-2xl border border-line bg-[#faf8f5] p-4 sm:p-4.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink">
                    Select Recipient Officers ({selectedUserIds.length} selected)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllOfficers}
                      className="rounded-md bg-white border border-line px-2.5 py-1 text-xs font-bold text-ink hover:bg-accent/20 transition"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedOfficers}
                      className="rounded-md bg-white border border-line px-2.5 py-1 text-xs font-bold text-ink-muted hover:text-danger-deep transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Recipient Checkboxes List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {users
                    .filter((u) => u.role === 'OFFICER')
                    .map((u) => {
                      const isChecked = selectedUserIds.includes(u.userId);
                      return (
                        <label
                          key={u.userId}
                          onClick={() => toggleUser(u.userId)}
                          className={`flex items-center gap-3 rounded-xl border p-2.5 sm:p-3 cursor-pointer transition select-none ${
                            isChecked
                              ? 'border-accent bg-accent/10 shadow-xs'
                              : 'border-line/60 bg-white hover:border-line'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="h-4 w-4 rounded text-accent focus:ring-accent"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-ink">{u.name}</span>
                              <span className="rounded bg-noir/5 px-1.5 py-0.5 text-[11px] font-bold text-ink-muted">
                                {u.dept}
                              </span>
                            </div>
                            <div className="mono text-xs text-ink-muted truncate mt-0.5">
                              {u.email}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>

                {/* Passphrase Allotment Mode Switcher */}
                <div className="pt-2 border-t border-line/60">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-ink">
                    Passphrase Allotment Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPassphraseMode('common')}
                      className={`rounded-xl py-2 px-3 text-xs font-bold transition border ${
                        passphraseMode === 'common'
                          ? 'bg-noir text-accent border-noir shadow-sm'
                          : 'bg-white text-ink-muted border-line hover:text-ink'
                      }`}
                    >
                      <LockIcon size={13} /> Common Passphrase
                    </button>
                    <button
                      type="button"
                      onClick={() => setPassphraseMode('individual')}
                      className={`rounded-xl py-2 px-3 text-xs font-bold transition border ${
                        passphraseMode === 'individual'
                          ? 'bg-noir text-accent border-noir shadow-sm'
                          : 'bg-white text-ink-muted border-line hover:text-ink'
                      }`}
                    >
                      <KeyIcon size={13} /> Individual Passphrases
                    </button>
                  </div>

                  {/* Mode A: Common Passphrase */}
                  {passphraseMode === 'common' && (
                    <div className="mt-3 space-y-1.5">
                      <label className="text-[11px] font-semibold text-ink-muted">
                        Common Passphrase for all selected officers
                      </label>
                      <input
                        type="text"
                        className="input font-mono text-xs w-full"
                        value={commonPassphrase}
                        onChange={(e) => setCommonPassphrase(e.target.value)}
                        placeholder="Enter common clearance passphrase (e.g. ClearancePass#2026)"
                      />
                      <p className="text-[11px] text-ink-faint">
                        All selected officers must enter this identical passphrase in their
                        dashboard to unlock this copy.
                      </p>
                    </div>
                  )}

                  {/* Mode B: Individual Passphrases */}
                  {passphraseMode === 'individual' && (
                    <div className="mt-3 space-y-2">
                      <label className="text-[11px] font-semibold text-ink-muted">
                        Set specific passphrase for each recipient officer:
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {users
                          .filter((u) => selectedUserIds.includes(u.userId))
                          .map((u) => (
                            <div
                              key={u.userId}
                              className="flex items-center gap-2 rounded-xl bg-white border border-line p-2 text-xs"
                            >
                              <span className="font-bold text-ink w-32 truncate">{u.name}</span>
                              <input
                                type="text"
                                className="input h-8 text-xs font-mono flex-1"
                                placeholder={`Custom secret for ${u.name}`}
                                value={individualPassphrases[u.userId] || ''}
                                onChange={(e) => setOfficerIndivPass(u.userId, e.target.value)}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── OFFICER: Locked Single Identity & Mandatory Passphrase ── */
              <div className="space-y-4">
                <Field label="Authorized Recipient">
                  <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-ink">{user?.name}</span>
                      <span className="pill bg-accent text-noir text-[10px] font-bold">
                        {user?.role}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">
                      Department: <strong className="text-ink">{user?.dept}</strong> · Only you can
                      decapsulate this copy with your allotted clearance key.
                    </div>
                  </div>
                </Field>

                {/* Mandatory Allotted Passphrase */}
                <div className="rounded-2xl border border-line bg-[#faf8f5] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wide text-ink flex items-center gap-1.5">
                      <span className="flex items-center gap-1.5">
                        <KeyIcon size={13} /> Allotted Clearance Passphrase
                      </span>
                      <span className="text-danger font-bold">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="text-[11px] font-semibold text-ink-muted hover:text-ink"
                    >
                      <span className="flex items-center gap-1.5">
                        {showPass ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                        {showPass ? 'Hide' : 'Show'}
                      </span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="input pr-10 text-sm font-mono"
                      value={officerPassphrase}
                      onChange={(e) => setOfficerPassphrase(e.target.value)}
                      placeholder="Enter the passphrase allotted by Admin"
                      required
                    />
                  </div>

                  <div className="text-[11px] text-ink-faint">
                    Without your exact allotted passphrase, cryptographic decapsulation will
                    strictly fail.
                  </div>
                </div>
              </div>
            )}

            {/* Device Label */}
            <Field label="Device Label">
              <input
                className="input text-xs"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                placeholder="DESK-114"
              />
            </Field>

            {/* Submit Action */}
            <button
              type="submit"
              className="btn-accent w-full h-12 text-sm font-extrabold shadow-md transition hover:scale-[1.01]"
              disabled={isBusy}
            >
              {isBusy ? (
                'Processing Cryptographic Release & Blockchain Anchor…'
              ) : isAdmin ? (
                <>
                  <SendIcon size={15} />
                  {`Decrypt & Dispatch to ${selectedUserIds.length} Officers`}
                </>
              ) : (
                <>
                  <UnlockIcon size={15} />
                  Verify Passphrase & Decrypt Document
                </>
              )}
            </button>

            {error && (
              <div className="rounded-xl border border-danger-bright bg-danger-tint p-4 text-xs font-semibold text-danger-deep space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm text-danger-deep">
                  <BanIcon size={14} /> Access / Clearance Error
                </div>
                <div>{error}</div>
              </div>
            )}
          </form>
        </div>

        {/* ── Right Column: Interactive Results & Receipts ─────────────── */}
        <div className="space-y-5 xl:col-span-6">
          {status === 'idle' && (
            <Notice>
              {isAdmin
                ? 'Choose a protected document, select the recipient officers, and assign passphrases to dispatch watermarked copies.'
                : 'Enter your allotted clearance passphrase to verify your identity, decapsulate the content key, and download your watermarked document.'}
            </Notice>
          )}

          {isBusy && (
            <div className="card grid place-items-center p-12 text-center space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
              <div className="mono text-sm font-bold text-ink animate-pulse">
                Embedding invisible Haar-DWT watermark & anchoring on Sepolia blockchain…
              </div>
              <div className="text-xs text-ink-muted">Zero-trust verification in progress.</div>
            </div>
          )}

          {/* ── Admin Multi-Officer Dispatch Results ── */}
          {status === 'done' && batchResult && (
            <div className="card p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-ink">
                    Dispatch Completed Successfully
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {batchResult.assetTitle} · {batchResult.totalDispatched} copies anchored
                    on-chain
                  </p>
                </div>
                <span className="pill bg-attributed-deep text-white font-bold text-xs">
                  DISPATCHED <CheckIcon size={11} />
                </span>
              </div>

              <div className="space-y-3">
                {batchResult.dispatches.map((d) => (
                  <div
                    key={d.userId}
                    className="rounded-2xl border border-line bg-[#faf8f5] p-4 space-y-2.5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-ink">{d.userName}</span>
                        <span className="text-xs font-semibold text-ink-muted">
                          [{d.department}]
                        </span>
                      </div>
                      <span className="mono rounded-full bg-line px-2.5 py-0.5 text-xs font-bold text-ink">
                        Passphrase: <strong className="text-noir">{d.allottedPassphrase}</strong>
                      </span>
                    </div>

                    <div className="mono text-xs text-ink-muted space-y-1">
                      <div>Receipt: {shortHash(d.receiptId, 10, 6)}</div>
                      <div>Tx Hash: {shortHash(d.txHash, 10, 6)}</div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/50">
                      {d.etherscanUrl ? (
                        <a
                          href={d.etherscanUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-pending-deep hover:underline"
                        >
                          View on Sepolia ↗
                        </a>
                      ) : (
                        <span />
                      )}

                      {d.downloadUrl && (
                        <a
                          href={markedFileUrl(d.downloadUrl)}
                          download
                          className="btn-accent h-8 px-3.5 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Download Watermarked Copy</span>
                          <span>↓</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Officer Single Decrypt Result ── */}
          {status === 'done' && singleResult && (
            <Receipt
              result={singleResult}
              officer={users.find((x) => x.userId === user?.userId) || user}
              asset={selectedAsset}
              device={deviceLabel}
              sigStatus={sigStatus}
            />
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Receipt Component ───────────────────────────────────────────────────────
function Receipt({ result, officer, asset, device, sigStatus }) {
  const clientSigned = sigStatus === 'ok';
  return (
    <div className="space-y-4">
      {/* On-chain receipt banner */}
      <div className="rounded-3xl bg-noir bg-gradient-to-br from-[#131b26] to-noir p-5 text-white shadow-panel">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span>On-chain Provenance Receipt</span>
          </h3>
          <span className="pill bg-accent text-noir font-bold">VERIFIED ON SEPOLIA</span>
        </div>
        <dl className="mono space-y-2 text-xs">
          <ChainRow k="receipt id" v={shortHash(result.receiptId, 10, 6)} />
          <ChainRow k="tx hash" v={shortHash(result.txHash, 10, 6)} />
          <ChainRow k="block" v={result.blockNumber ?? '—'} />
          <ChainRow k="payload" v={`${result.payloadBits?.length ?? 0} bits embedded`} />
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
            View on Sepolia Etherscan ↗
          </a>
        )}
      </div>

      {/* Internal registry group */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <h3 className="text-sm font-bold text-ink">Decrypted Document Registry</h3>
          <span className="rounded bg-attributed-tint px-2 py-0.5 text-[10px] font-bold text-attributed-deep">
            PASSPHRASE AUTHENTICATED
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Reg k="Officer" v={officer?.name} />
          <Reg k="Department" v={officer?.dept} />
          <Reg k="Document" v={asset?.title} />
          <Reg k="Device" v={device} />
          <Reg k="PSNR" v={result.psnrDb != null ? `${result.psnrDb.toFixed(1)} dB` : '—'} />
          <Reg k="QIM strength" v={`Δ = ${result.deltaUsed}`} />
        </dl>

        <div className="pt-2">
          <a
            href={markedFileUrl(result.downloadUrl)}
            className="btn-accent w-full h-11 text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm"
            download
          >
            <DownloadIcon size={15} /> Download Watermarked Document
          </a>
        </div>
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
