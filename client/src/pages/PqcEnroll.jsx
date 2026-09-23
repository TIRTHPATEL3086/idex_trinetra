import { useState, useEffect, useCallback } from 'react';
import { getUsers, getPqcPublicKey, generatePqcKeys, shortHash } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Header, Notice } from './Assets.jsx';
import { CheckIcon, CloseIcon, EyeIcon, EyeOffIcon, ShieldIcon } from '../components/icons.jsx';

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

function StatTile({ label, value, highlight }) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl p-2.5 sm:p-3 transition min-w-[75px] sm:min-w-[90px] ${
        highlight ? 'bg-lime text-night shadow-md' : 'bg-night-soft text-white'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
            highlight ? 'text-night/80' : 'text-white/60'
          }`}
        >
          {label}
        </span>
        <ArrowUpRight highlight={highlight} />
      </div>
      <div className="font-display mt-1 sm:mt-1.5 text-xl sm:text-2xl font-extrabold">{value}</div>
    </div>
  );
}

export default function PqcEnroll() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [keyStatuses, setKeyStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrollingUser, setEnrollingUser] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(null);
  const [modalError, setModalError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { users: userList } = await getUsers();
      setUsers(userList);

      // Load key status for all fetched users in parallel
      const statuses = {};
      await Promise.all(
        userList.map(async (u) => {
          try {
            const k = await getPqcPublicKey(u.userId);
            statuses[u.userId] = k;
          } catch {
            statuses[u.userId] = { hasPqcKeys: false };
          }
        })
      );
      setKeyStatuses(statuses);
    } catch (err) {
      setError(err.message || 'Failed to load officers list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEnrollModal = (targetUser) => {
    setEnrollingUser(targetUser);
    setPassphrase('');
    setConfirmPassphrase('');
    setShowPass(false);
    setModalError(null);
    setEnrollSuccess(null);
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!passphrase || passphrase.length < 6) {
      setModalError('Passphrase must be at least 6 characters.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setModalError('Passphrases do not match.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await generatePqcKeys(passphrase, enrollingUser.userId);
      setEnrollSuccess(res);
      // Reload statuses in background
      const updated = await getPqcPublicKey(enrollingUser.userId);
      setKeyStatuses((prev) => ({ ...prev, [enrollingUser.userId]: updated }));
    } catch (err) {
      setModalError(err.message || 'Failed to generate and enroll PQC keys');
    } finally {
      setSubmitting(false);
    }
  };

  // Passphrase strength estimation
  const getStrength = (p) => {
    if (!p) return { label: 'None', width: '0%', color: 'bg-line' };
    if (p.length < 6) return { label: 'Too short (<6 chars)', width: '25%', color: 'bg-danger' };
    if (p.length < 9) return { label: 'Fair (Acceptable)', width: '50%', color: 'bg-probable' };
    if (/[0-9]/.test(p) && /[A-Za-z]/.test(p) && /[^A-Za-z0-9]/.test(p)) {
      return { label: 'Strong (High Security)', width: '100%', color: 'bg-attributed' };
    }
    return { label: 'Good', width: '75%', color: 'bg-accent' };
  };

  const strength = getStrength(passphrase);
  const totalUsers = users.length;
  const enrolledCount = Object.values(keyStatuses).filter((s) => s.hasPqcKeys).length;
  const pendingCount = totalUsers - enrolledCount;

  return (
    <section className="space-y-6">
      <Header eyebrow="Key management" title="Post-Quantum Cryptography Enrollment" />

      {error && <Notice tone="error">{error}</Notice>}

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Total Officers
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
            {loading ? '—' : totalUsers}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Registered in authorization directory</p>
        </div>

        <div className="rounded-xl border border-line bg-white p-5 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">
            PQC Enrolled
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
            {loading ? '—' : enrolledCount}
          </div>

        <div className="rounded-xl border border-line bg-white p-5 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-probable">
            Pending Keys
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
            {loading ? '—' : pendingCount}
          </div>
        </div>
      </div>

      {/* Main Roster Table */}
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-base font-semibold text-ink">Officer Cryptographic Roster</h2>
          <p className="text-xs text-ink-muted">
            Inspect public key parameters and issue post-quantum credentials.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs sm:text-sm text-ink-muted">
            <div className="mx-auto mb-2.5 h-7 w-7 animate-spin rounded-full border-2 border-lime border-t-transparent" />
            Loading officer cryptographic credentials…
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[460px] scroll-slim">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line/60 bg-noir/20 text-xs font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Officer / Role</th>
                  <th className="px-5 py-3 font-bold">Department</th>
                  <th className="px-5 py-3 font-bold">PQC Status</th>
                  <th className="px-5 py-3 font-bold">ML-KEM-768 (KEM)</th>
                  <th className="px-5 py-3 font-bold">ML-DSA-65 (Sig)</th>
                  <th className="px-5 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {users.map((u) => {
                  const status = keyStatuses[u.userId];
                  const isEnrolled = status?.hasPqcKeys;

                  return (
                    <tr key={u.userId} className="transition-colors hover:bg-muted">
                      <td className="px-6 py-4">
                        <div className="font-bold text-ink text-sm">{u.name}</div>
                        <div className="flex items-center gap-2 text-xs text-ink-muted mt-0.5 flex-wrap">
                          <span className="pill !text-[10px] !py-0.5 bg-line/60 text-ink font-semibold">
                            {u.roleLabel || u.role}
                          </span>
                          <span className="text-ink-faint">·</span>
                          <span
                            className="mono text-[11px] text-ink-muted font-medium cursor-help"
                            title={`On-Chain Handle: ${u.userRef}`}
                          >
                            {shortHash(u.userRef, 8, 6)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs sm:text-sm text-ink-muted font-medium">
                        {u.dept}
                      </td>
                      <td className="px-6 py-4">
                        {isEnrolled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-attributed/10 px-2.5 py-1 text-xs font-bold text-attributed-deep ring-1 ring-attributed/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-attributed animate-pulse" />
                            Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-probable/10 px-2.5 py-1 text-xs font-bold text-probable-deep ring-1 ring-probable/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-probable" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {status?.kemPublicKey ? (
                          <span
                            title={status.kemPublicKey}
                            className="mono text-xs font-bold text-ink bg-[#fbfbf7] border border-line px-2.5 py-1 rounded-lg inline-block"
                          >
                            {shortHash(status.kemPublicKey, 6, 4)}
                          </span>
                        ) : (
                          <span className="mono text-xs text-ink-faint font-semibold">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {status?.dsaPublicKey ? (
                          <span
                            title={status.dsaPublicKey}
                            className="mono text-xs font-bold text-ink bg-[#fbfbf7] border border-line px-2.5 py-1 rounded-lg inline-block"
                          >
                            {shortHash(status.dsaPublicKey, 6, 4)}
                          </span>
                        ) : (
                          <span className="mono text-xs text-ink-faint font-semibold">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEnrollModal(u)}
                          className="rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-xs transition hover:border-accent-deep hover:bg-accent/20"
                        >
                          {isEnrolled ? 'Re-enroll' : 'Enroll PQC'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Polished Enrollment Modal ───────────────────────────────────── */}
      {enrollingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line/60 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">Set Officer PQC Passphrase</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Target: <span className="font-semibold text-ink">{enrollingUser.name}</span> (
                  {enrollingUser.dept})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollingUser(null)}
                className="rounded-xl border border-line p-1.5 text-xs text-ink-muted hover:bg-night/5 hover:text-ink transition cursor-pointer"
              >
                <CloseIcon size={15} />
              </button>
            </div>

            {enrollSuccess ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg bg-attributed/10 border border-attributed/20 p-4 text-sm text-attributed-bright">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckIcon size={14} /> Post-Quantum Keypair Provisioned
                  </div>
                  <p className="mt-1 text-xs text-attributed-bright/80 leading-relaxed">
                    ML-KEM-768 and ML-DSA-65 keys generated successfully. The private key bundle was
                    encrypted with scrypt + AES-GCM under your chosen passphrase.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg bg-muted p-3 font-mono text-xs">
                  <div>
                    <span className="text-ink-muted">KEM Public Key: </span>
                    <span className="text-ink font-semibold">
                      {shortHash(enrollSuccess.kemPublicKey, 8, 8)}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-muted">DSA Public Key: </span>
                    <span className="text-ink font-semibold">
                      {shortHash(enrollSuccess.dsaPublicKey, 8, 8)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-muted border border-line p-3 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Important:</span> Remember this
                  passphrase. Officer <strong>{enrollingUser.name}</strong> will enter this
                  passphrase in the browser during document decryption to unlock their ML-DSA-65
                  signing key.
                </div>

                <button
                  type="button"
                  onClick={() => setEnrollingUser(null)}
                  className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-noir transition hover:bg-accent-bright"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnroll} className="space-y-4">
                {/* Security explainer badge */}
                <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs text-ink">
                  <div className="font-semibold text-accent flex items-center gap-1.5">
                    <ShieldIcon size={14} /> Post-Quantum Private Key Protection
                  </div>
                  <p className="mt-1 text-ink-muted text-[11px] leading-relaxed">
                    This passphrase derives an AES-256-GCM key via scrypt to seal the officer's
                    private keys. The private key is unlocked strictly in the client's browser
                    during decryption.
                  </p>
                </div>

                {modalError && (
                  <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-xs text-danger-bright">
                    {modalError}
                  </div>
                )}

                {/* Passphrase Input with Show/Hide toggle */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                      New Passphrase
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="text-xs text-ink-muted hover:text-ink font-semibold cursor-pointer"
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
                      required
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder-ink-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  {/* Password Strength Indicator */}
                  {passphrase && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-muted">Security Strength:</span>
                        <span className="font-bold text-ink">{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-line overflow-hidden border border-line/40">
                        <div
                          className={`h-full ${strength.color} transition-all duration-300`}
                          style={{ width: strength.width }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Passphrase Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Confirm Passphrase
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Re-enter passphrase"
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder-ink-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {confirmPassphrase && passphrase !== confirmPassphrase && (
                    <p className="mt-1 text-[11px] text-danger-bright">Passphrases do not match</p>
                  )}
                  {confirmPassphrase && passphrase === confirmPassphrase && (
                    <p className="mt-1 text-[11px] text-attributed-bright">
                      <CheckIcon size={11} /> Passphrases match
                    </p>
                  )}
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEnrollingUser(null)}
                    className="flex-1 rounded-xl border border-line bg-white py-2.5 text-sm font-semibold text-ink hover:bg-noir/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submitting || passphrase.length < 6 || passphrase !== confirmPassphrase
                    }
                    className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-noir transition hover:bg-accent-bright disabled:opacity-50"
                  >
                    {submitting ? 'Generating…' : 'Save & Provision'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
