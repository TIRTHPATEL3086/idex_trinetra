import { useState, useEffect, useCallback } from 'react';
import { getUsers, getPqcPublicKey, generatePqcKeys, shortHash } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Header, Notice } from './Assets.jsx';

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
    if (!p) return { label: 'None', width: '0%', color: 'bg-edge' };
    if (p.length < 6) return { label: 'Too short (<6 chars)', width: '25%', color: 'bg-rose-500' };
    if (p.length < 9) return { label: 'Fair (Acceptable)', width: '50%', color: 'bg-amber-500' };
    if (/[0-9]/.test(p) && /[A-Za-z]/.test(p) && /[^A-Za-z0-9]/.test(p)) {
      return { label: 'Strong (High Security)', width: '100%', color: 'bg-emerald-500' };
    }
    return { label: 'Good', width: '75%', color: 'bg-lime-500' };
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

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-edge bg-card/60 p-5 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Total Officers</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">{loading ? '—' : totalUsers}</div>
          <p className="mt-1 text-xs text-ink-muted">Registered in authorization directory</p>
        </div>

        <div className="rounded-xl border border-edge bg-card/60 p-5 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-lime-400">PQC Enrolled</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
            {loading ? '—' : enrolledCount}
          </div>
          <p className="mt-1 text-xs text-ink-muted">ML-KEM-768 & ML-DSA-65 active</p>
        </div>

        <div className="rounded-xl border border-edge bg-card/60 p-5 backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">Pending Keys</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
            {loading ? '—' : pendingCount}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Requires keypair provisioning</p>
        </div>
      </div>

      {/* Main Roster Table */}
      <div className="overflow-hidden rounded-xl border border-edge bg-card">
        <div className="border-b border-edge px-6 py-4">
          <h2 className="text-base font-semibold text-ink">Officer Cryptographic Roster</h2>
          <p className="text-xs text-ink-muted">
            Inspect public key parameters and issue post-quantum credentials.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading officer credentials…</div>
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-edge/60 bg-night/20 text-xs font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-6 py-3.5">Officer / Role</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">PQC Status</th>
                  <th className="px-6 py-3.5">ML-KEM-768 (KEM)</th>
                  <th className="px-6 py-3.5">ML-DSA-65 (Sig)</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/40">
                {users.map((u) => {
                  const status = keyStatuses[u.userId];
                  const isEnrolled = status?.hasPqcKeys;

                  return (
                    <tr key={u.userId} className="transition-colors hover:bg-night/10">
                      <td className="px-6 py-4">
                        <div className="font-bold text-ink text-sm">{u.name}</div>
                        <div className="flex items-center gap-2 text-xs text-ink-muted mt-0.5">
                          <span className="font-semibold">{u.roleLabel || u.role}</span>
                          <span>•</span>
                          <span className="font-mono text-xs text-ink-muted/90">{u.userRef}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs sm:text-sm text-ink-muted font-medium">{u.dept}</td>
                      <td className="px-6 py-4">
                        {isEnrolled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 ring-1 ring-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 ring-1 ring-amber-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-ink-muted">
                        {status?.kemPublicKey ? (
                          <span title={status.kemPublicKey} className="font-semibold">
                            {shortHash(status.kemPublicKey, 6, 6)}
                          </span>
                        ) : (
                          <span className="text-ink-muted/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-ink-muted">
                        {status?.dsaPublicKey ? (
                          <span title={status.dsaPublicKey} className="font-semibold">
                            {shortHash(status.dsaPublicKey, 6, 6)}
                          </span>
                        ) : (
                          <span className="text-ink-muted/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEnrollModal(u)}
                          className="rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-xs transition hover:border-lime-deep hover:bg-lime/20"
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

      {/* Enhanced Enrollment Modal with Passphrase Controls */}
      {enrollingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-edge bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-edge/60 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  Set Officer PQC Passphrase
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Target: <span className="font-semibold text-ink">{enrollingUser.name}</span> ({enrollingUser.dept})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollingUser(null)}
                className="rounded-lg p-1 text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            {enrollSuccess ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400">
                  <div className="font-semibold">✓ Post-Quantum Keypair Provisioned</div>
                  <p className="mt-1 text-xs text-emerald-300/80 leading-relaxed">
                    ML-KEM-768 and ML-DSA-65 keys generated successfully. The private key bundle was encrypted with scrypt + AES-GCM under your chosen passphrase.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg bg-night/30 p-3 font-mono text-xs">
                  <div>
                    <span className="text-ink-muted">KEM Public Key: </span>
                    <span className="text-ink font-semibold">{shortHash(enrollSuccess.kemPublicKey, 8, 8)}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">DSA Public Key: </span>
                    <span className="text-ink font-semibold">{shortHash(enrollSuccess.dsaPublicKey, 8, 8)}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-night/20 border border-edge p-3 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Important:</span> Remember this passphrase. Officer <strong>{enrollingUser.name}</strong> will enter this passphrase in the browser during document decryption to unlock their ML-DSA-65 signing key.
                </div>

                <button
                  type="button"
                  onClick={() => setEnrollingUser(null)}
                  className="w-full rounded-xl bg-lime-400 py-2.5 text-sm font-semibold text-night transition hover:bg-lime-300"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnroll} className="mt-5 space-y-4">
                {/* Security explainer badge */}
                <div className="rounded-xl border border-lime-500/30 bg-lime-500/10 p-3 text-xs text-ink">
                  <div className="font-semibold text-lime-400 flex items-center gap-1.5">
                    <span>🛡️</span> Post-Quantum Private Key Protection
                  </div>
                  <p className="mt-1 text-ink-muted text-[11px] leading-relaxed">
                    This passphrase derives an AES-256-GCM key via scrypt to seal the officer's private keys. The private key is unlocked strictly in the client's browser during decryption.
                  </p>
                </div>

                {/* Quick Presets helper bar */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Quick Preset:</span>
                  <button
                    type="button"
                    onClick={() => setPresetPassphrase('officer123')}
                    className="rounded-lg border border-edge bg-night/30 px-2.5 py-1 text-[11px] font-medium text-ink hover:border-lime-500/50 hover:text-lime-400 transition"
                  >
                    Default Demo (<span className="mono">officer123</span>)
                  </button>
                </div>

                {modalError && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
                    {modalError}
                  </div>
                )}

                {/* Passphrase Input with Show/Hide toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      New Passphrase
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="text-[11px] text-ink-muted hover:text-ink font-medium"
                    >
                      {showPass ? 'Hide 👁️' : 'Show 👁️'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-xl border border-edge bg-night/30 px-3.5 py-2.5 text-sm text-ink placeholder-ink-muted/50 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                    />
                  </div>

                  {/* Password Strength Indicator */}
                  {passphrase && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-ink-muted">Security Strength:</span>
                        <span className="font-semibold text-ink">{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-night/40 overflow-hidden border border-edge/40">
                        <div
                          className={`h-full ${strength.color} transition-all duration-300`}
                          style={{ width: strength.width }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Passphrase Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
                    Confirm Passphrase
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Re-enter passphrase"
                    className="w-full rounded-xl border border-edge bg-night/30 px-3.5 py-2.5 text-sm text-ink placeholder-ink-muted/50 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                  />
                  {confirmPassphrase && passphrase !== confirmPassphrase && (
                    <p className="mt-1 text-[11px] text-rose-400">Passphrases do not match</p>
                  )}
                  {confirmPassphrase && passphrase === confirmPassphrase && (
                    <p className="mt-1 text-[11px] text-emerald-400">✓ Passphrases match</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEnrollingUser(null)}
                    className="flex-1 rounded-xl border border-edge bg-night/20 py-2.5 text-sm font-semibold text-ink hover:bg-night/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || passphrase.length < 6 || passphrase !== confirmPassphrase}
                    className="flex-1 rounded-xl bg-lime-400 py-2.5 text-sm font-semibold text-night transition hover:bg-lime-300 disabled:opacity-50"
                  >
                    {submitting ? 'Encrypting & Generating…' : 'Save & Provision'}
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
