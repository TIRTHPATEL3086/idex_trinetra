import { useState, useEffect, useCallback } from 'react';
import { getUsers, getPqcPublicKey, generatePqcKeys, shortHash } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Header, Notice } from './Assets.jsx';

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

  const setPresetPassphrase = (preset) => {
    setPassphrase(preset);
    setConfirmPassphrase(preset);
    setModalError(null);
  };

  // Passphrase strength estimation
  const getStrength = (p) => {
    if (!p) return { label: 'None', width: '0%', color: 'bg-line' };
    if (p.length < 6) return { label: 'Too short (<6 chars)', width: '25%', color: 'bg-rose-500' };
    if (p.length < 9) return { label: 'Fair (Acceptable)', width: '50%', color: 'bg-amber-500' };
    if (/[0-9]/.test(p) && /[A-Za-z]/.test(p) && /[^A-Za-z0-9]/.test(p)) {
      return { label: 'Strong (High Security)', width: '100%', color: 'bg-emerald-500' };
    }
    return { label: 'Good', width: '75%', color: 'bg-lime' };
  };

  const strength = getStrength(passphrase);
  const totalUsers = users.length;
  const enrolledCount = Object.values(keyStatuses).filter((s) => s.hasPqcKeys).length;
  const pendingCount = totalUsers - enrolledCount;

  return (
    <section className="space-y-6">
      <Header
        title="Post-Quantum Cryptography Enrollment"
        subtitle="Provision NIST FIPS 203 (ML-KEM-768) and FIPS 204 (ML-DSA-65) quantum-resistant identity keypairs for authorized officers."
      />

      {error && <Notice tone="error">{error}</Notice>}

      {/* ── Dark Overview Hero Panel (Provenance Signature Style) ──────── */}
      <div className="relative overflow-hidden rounded-3xl bg-night p-6 text-white shadow-panel sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-400">
              <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse" />
              Quantum-Resistant PKI Infrastructure
            </div>
            <div className="font-display mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              {enrolledCount} of {totalUsers}{' '}
              <span className="text-white/40 font-normal">officers enrolled</span>
            </div>
            <p className="mt-2 max-w-xl text-xs sm:text-sm text-white/70 leading-relaxed">
              Every officer identity is provisioned with NIST ML-KEM-768 broadcast decapsulation keys and ML-DSA-65 non-repudiation signing keys. Private key bundles are sealed via scrypt + AES-256-GCM.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 shrink-0 w-full xl:w-auto">
            <StatTile label="Officers" value={totalUsers} />
            <StatTile label="Enrolled" value={enrolledCount} highlight />
            <StatTile label="Pending" value={pendingCount} />
          </div>
        </div>
      </div>

      {/* ── Officer Cryptographic Roster Card ───────────────────────────── */}
      <div className="card overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line px-6 py-4 bg-night/[0.01]">
          <div>
            <h2 className="text-base font-extrabold text-ink">Officer Cryptographic Roster</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Inspect public key parameters, verify algorithms, and provision post-quantum credentials.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="pill !bg-lime/20 !text-ink text-xs font-bold">
              NIST FIPS 203 / 204
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-ink-muted">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lime border-t-transparent" />
            Loading officer cryptographic credentials…
          </div>
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-night/[0.02] text-xs font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-6 py-3.5 font-bold">Officer / Role</th>
                  <th className="px-6 py-3.5 font-bold">Department</th>
                  <th className="px-6 py-3.5 font-bold">PQC Status</th>
                  <th className="px-6 py-3.5 font-bold">ML-KEM-768 (KEM)</th>
                  <th className="px-6 py-3.5 font-bold">ML-DSA-65 (Sig)</th>
                  <th className="px-6 py-3.5 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {users.map((u) => {
                  const status = keyStatuses[u.userId];
                  const isEnrolled = status?.hasPqcKeys;

                  return (
                    <tr key={u.userId} className="transition-colors hover:bg-line/25">
                      <td className="px-6 py-4">
                        <div className="font-bold text-ink text-sm">{u.name}</div>
                        <div className="flex items-center gap-2 text-xs text-ink-muted mt-1 flex-wrap">
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
                      <td className="px-6 py-4 text-xs sm:text-sm text-ink-muted font-semibold">
                        {u.dept}
                      </td>
                      <td className="px-6 py-4">
                        {isEnrolled ? (
                          <span className="pill !bg-emerald-50 !text-emerald-700 text-xs font-bold border border-emerald-200/70 inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Enrolled
                          </span>
                        ) : (
                          <span className="pill !bg-amber-50 !text-amber-700 text-xs font-bold border border-amber-200/70 inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEnrollModal(u)}
                          className={
                            isEnrolled
                              ? 'btn-ghost !text-xs !py-1.5 !px-3.5'
                              : 'btn-lime !text-xs !py-1.5 !px-3.5 shadow-xs'
                          }
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
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm"
          onClick={() => setEnrollingUser(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-panel border border-line space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-lime" />
                  <h3 className="text-base font-extrabold text-ink">Set Officer PQC Passphrase</h3>
                </div>
                <p className="text-xs text-ink-muted mt-1">
                  Target: <strong className="text-ink">{enrollingUser.name}</strong> ({enrollingUser.dept})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollingUser(null)}
                className="rounded-xl border border-line p-1.5 text-xs text-ink-muted hover:bg-night/5 hover:text-ink transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {enrollSuccess ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200/80 p-4 text-xs text-emerald-800 space-y-1">
                  <div className="font-extrabold text-sm text-emerald-900">
                    ✓ Post-Quantum Keypair Provisioned
                  </div>
                  <p className="leading-relaxed text-emerald-700">
                    ML-KEM-768 and ML-DSA-65 keys generated successfully. The private key bundle was encrypted with scrypt + AES-256-GCM under your chosen passphrase.
                  </p>
                </div>

                <div className="space-y-2 rounded-2xl bg-[#fbfbf7] border border-line p-3.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">KEM Public Key:</span>
                    <span className="text-ink font-bold">{shortHash(enrollSuccess.kemPublicKey, 8, 8)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">DSA Public Key:</span>
                    <span className="text-ink font-bold">{shortHash(enrollSuccess.dsaPublicKey, 8, 8)}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-line p-3 text-xs text-ink-muted leading-relaxed">
                  <strong className="text-ink">Important:</strong> Remember this passphrase. Officer{' '}
                  <strong>{enrollingUser.name}</strong> will enter this passphrase in the browser during document decryption to unlock their ML-DSA-65 signing key.
                </div>

                <button
                  type="button"
                  onClick={() => setEnrollingUser(null)}
                  className="btn-lime w-full text-sm font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnroll} className="space-y-4">
                {/* Security explainer badge */}
                <div className="rounded-2xl border border-lime/40 bg-lime/10 p-3.5 text-xs text-ink">
                  <div className="font-bold text-ink flex items-center gap-1.5">
                    <span>🛡️</span> Post-Quantum Private Key Protection
                  </div>
                  <p className="mt-1 text-ink-muted text-[11px] leading-relaxed">
                    This passphrase derives an AES-256-GCM key via scrypt to seal the officer's private keys. The private key is unlocked strictly in the client's browser during decryption.
                  </p>
                </div>

                {/* Quick Presets helper bar */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                    Quick Preset:
                  </span>
                  <button
                    type="button"
                    onClick={() => setPresetPassphrase('officer123')}
                    className="rounded-xl border border-line bg-[#fbfbf7] px-3 py-1 text-xs font-bold text-ink hover:border-lime-deep hover:bg-lime/20 transition cursor-pointer"
                  >
                    Demo Default (<span className="mono">officer123</span>)
                  </button>
                </div>

                {modalError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
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
                      {showPass ? 'Hide 👁️' : 'Show 👁️'}
                    </button>
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="input text-sm font-mono"
                  />

                  {/* Password Strength Indicator */}
                  {passphrase && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-muted">Security Strength:</span>
                        <span className="font-bold text-ink">{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden border border-line">
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
                    className="input text-sm font-mono"
                  />
                  {confirmPassphrase && passphrase !== confirmPassphrase && (
                    <p className="text-[11px] font-bold text-rose-600">Passphrases do not match</p>
                  )}
                  {confirmPassphrase && passphrase === confirmPassphrase && (
                    <p className="text-[11px] font-bold text-emerald-600">✓ Passphrases match</p>
                  )}
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEnrollingUser(null)}
                    className="btn-ghost flex-1 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || passphrase.length < 6 || passphrase !== confirmPassphrase}
                    className="btn-lime flex-1 text-xs"
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
