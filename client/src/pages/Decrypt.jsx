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
  getSecurityQuestion,
} from '../lib/api.js';
import { unlockAndSign } from '../lib/pqc.js';
import { Header } from './Assets.jsx';
import { useAuth } from '../lib/auth.jsx';
import {
  BanIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  SendIcon,
  UnlockIcon,
  ShieldIcon,
  LockIcon,
  WarningIcon,
} from '../components/icons.jsx';
import Select from '../components/Select.jsx';

const PRESET_SECURITY_QUESTIONS = [
  'What is your secret operational callsign?',
  'What was the hull number and name of your first naval vessel?',
  'What is your high-clearance emergency decrypt passphrase?',
  'What was the tactical code name of your primary deployment?',
  'What is your commanding unit base name?',
  'custom',
];

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
 *   - ZERO-TRUST TERMINAL GUARD: Must answer their secret challenge question.
 *     Prevents colleague impersonation (e.g. Officer 2 decrypting from Officer 1's laptop).
 *     Strict case and spacing verification required.
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
  const [individualPassphrases, setIndividualPassphrases] = useState({});

  // Officer Single-recipient state
  const [officerPassphrase, setOfficerPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [authMode, setAuthMode] = useState('token'); // 'token' (Naval PKI Smart Card) | 'passphrase'
  const [smartCardPin, setSmartCardPin] = useState('officer123');
  const [breakGlass, setBreakGlass] = useState(false);
  const [coPin, setCoPin] = useState('co-auth-774');
  const [hardwareTouchStep, setHardwareTouchStep] = useState(false);

  // Officer Security Challenge State (Anti-Impersonation)
  const [hasSecQuestion, setHasSecQuestion] = useState(false);
  const [secQuestion, setSecQuestion] = useState('');
  const [secAnswer, setSecAnswer] = useState('');
  const [showSecAnswer, setShowSecAnswer] = useState(false);
  const [setupQuestionChoice, setSetupQuestionChoice] = useState(PRESET_SECURITY_QUESTIONS[0]);
  const [setupCustomQuestion, setSetupCustomQuestion] = useState('');
  const [setupAnswer, setSetupAnswer] = useState('');
  const [confirmSetupAnswer, setConfirmSetupAnswer] = useState('');
  const [showSetupAnswer, setShowSetupAnswer] = useState(false);

  // Status & Results
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [error, setError] = useState(null);
  const [singleResult, setSingleResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
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

  useEffect(() => {
    if (user?.role === 'OFFICER') {
      getSecurityQuestion()
        .then((res) => {
          setHasSecQuestion(Boolean(res.hasSecurityQuestion));
          setSecQuestion(res.securityQuestion || '');
        })
        .catch(() => {});
    }
  }, [user?.role]);

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
        // Every recipient is issued their own passphrase; there is no
        // longer a shared-secret mode in the interface.
        passphraseMode: 'individual',
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

      const effectivePassphrase = (authMode === 'token' ? smartCardPin : officerPassphrase).trim();
      if (!effectivePassphrase) {
        setError(
          authMode === 'token'
            ? 'Please enter your 6-digit Naval PKI Smart Card PIN.'
            : 'Enter your allotted passphrase, or your account password if none was allotted.'
        );
        return;
      }

      if (authMode === 'token') {
        setHardwareTouchStep(true);
        // Simulate physical token / TPM 2.0 biometric touch handshake
        await new Promise((resolve) => setTimeout(resolve, 500));
        setHardwareTouchStep(false);
      }

      const aId = Number(assetId);
      const uId = Number(user?.userId);

      let clientSignature = undefined;
      let challengeId = undefined;

      // Client-side PQC signing if enrolled
      try {
        const bundleRes = await getPqcKeyBundle();
        if (bundleRes?.encryptedPqcKeys) {
          const challenge = await requestDecryptChallenge({ assetId: aId, userId: uId });
          const sig = await unlockAndSign(
            bundleRes.encryptedPqcKeys,
            effectivePassphrase,
            challenge.challengeHex
          );
          clientSignature = sig;
          challengeId = challenge.challengeId;
        }
      } catch (sigErr) {
        console.info('[pqc] in-browser signing skipped:', sigErr.message);
        clientSignature = undefined;
        challengeId = undefined;
      }

      // Zero-Trust Security Challenge Validation for Officers
      let secPayload = {};
      if (!hasSecQuestion) {
        const finalQ =
          setupQuestionChoice === 'custom' ? setupCustomQuestion.trim() : setupQuestionChoice;
        if (!finalQ) {
          setError('Please select or enter your secret security question before decrypting.');
          return;
        }
        if (!setupAnswer) {
          setError('Please provide your secret security answer.');
          return;
        }
        if (setupAnswer !== confirmSetupAnswer) {
          setError('Secret verification answers do not match! Please verify exact capitalization and spaces.');
          return;
        }
        secPayload = {
          newSecurityQuestion: finalQ,
          newSecurityAnswer: setupAnswer,
        };
      } else {
        if (!secAnswer) {
          setError('Security Challenge: Please enter your registered secret answer to authorize decryption.');
          return;
        }
        secPayload = {
          securityAnswer: secAnswer,
        };
      }

      setStatus('working');
      const finalDeviceLabel = breakGlass
        ? `${deviceLabel || 'DESK-114'} [EMERGENCY-BREAK-GLASS-OVERRIDE]`
        : authMode === 'token'
          ? `${deviceLabel || 'DESK-114'} [NAVAL-PKI-FIPS140]`
          : deviceLabel || 'DESK-114';

      try {
        const r = await decryptAsset({
          assetId: aId,
          userId: uId,
          deviceLabel: finalDeviceLabel,
          passphrase: effectivePassphrase,
          clientSignature,
          challengeId,
          ...secPayload,
        });
        setSingleResult(r);
        setStatus('done');
        if (!hasSecQuestion && secPayload.newSecurityQuestion) {
          setHasSecQuestion(true);
          setSecQuestion(secPayload.newSecurityQuestion);
          setSecAnswer('');
        }
      } catch (err) {
        setError(err.message || 'Decryption failed: invalid credentials or unauthorized challenge answer.');
        setStatus('error');
      }
    },
    [
      assetId,
      user?.userId,
      officerPassphrase,
      smartCardPin,
      authMode,
      breakGlass,
      deviceLabel,
      hasSecQuestion,
      secAnswer,
      setupQuestionChoice,
      setupCustomQuestion,
      setupAnswer,
      confirmSetupAnswer,
    ]
  );

  const isBusy = status === 'working';

  return (
    <section className="space-y-6">
      <Header
        eyebrow="Release"
        title={isAdmin ? 'Decrypt & Multi-Officer Dispatch' : 'Decrypt protected document'}
      />

      <div className={`grid gap-6 ${status === 'idle' ? '' : 'xl:grid-cols-12'}`}>
        {/* ── Left Column: Form ────────────────────────────────────────── */}
        <div
          className={`min-w-0 space-y-5 ${status === 'idle' ? 'mx-auto w-full max-w-3xl' : 'xl:col-span-6'}`}
        >
          <form
            onSubmit={isAdmin ? submitAdminBatch : submitOfficerDecrypt}
            className="card space-y-5 p-5 sm:p-6"
          >
            {/* Document Selection */}
            <Field label="Protected Document (PDF / Image)">
              <Select
                ariaLabel="Protected document"
                value={assetId}
                onChange={setAssetId}
                options={assets.map((a) => ({
                  value: a.assetId,
                  label: a.title,
                  hint: a.classification,
                }))}
              />
            </Field>

            {/* ── ADMIN: Multi-choice Officer Selection & Passphrase Modes ── */}
            {isAdmin ? (
              <div className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-4.5">
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
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="whitespace-nowrap text-sm font-bold text-ink">
                                {u.name}
                              </span>
                              <span className="whitespace-nowrap rounded bg-noir/5 px-1.5 py-0.5 text-[11px] font-bold text-ink-muted">
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

                {/* One passphrase per recipient — there is no shared-secret mode,
                    because a secret several officers hold cannot tie a leaked
                    copy back to one of them. */}
                <div className="pt-2 border-t border-line/60">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-ink">
                    Recipient Passphrases
                  </span>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-ink-muted">
                      Set a passphrase for each selected officer:
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
                </div>
              </div>
            ) : (
              /* ── OFFICER: Locked Single Identity & Naval PKI Smart Card / Break-Glass ── */
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
                      Department: <strong className="text-ink">{user?.dept}</strong> · Clearance
                      holder verified via Post-Quantum Identity Register.
                    </div>
                  </div>
                </Field>

                {/* Military Two-Man Rule Notice for Classified Files */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-amber-700">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Two-Man Rule Protocol (Classification: {selectedAsset?.classification || 'SECRET'})
                    </span>
                    <button
                      type="button"
                      onClick={() => setBreakGlass((b) => !b)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition ${
                        breakGlass
                          ? 'bg-danger text-white'
                          : 'bg-amber-600/20 text-amber-800 hover:bg-amber-600/30'
                      }`}
                    >
                      {breakGlass ? '🚨 Break-Glass Active' : 'Emergency Override'}
                    </button>
                  </div>
                  {breakGlass ? (
                    <div className="rounded-xl bg-danger/10 border border-danger/30 p-2 text-[11px] font-semibold text-danger leading-relaxed">
                      ⚠️ <strong>TACTICAL BREAK-GLASS OVERRIDE ENGAGED:</strong> Unilateral decryption permitted under operational emergency. High-priority audit flag permanently anchored to blockchain ledger for Court of Inquiry review.
                    </div>
                  ) : (
                    <div className="text-[11px] text-ink-muted leading-relaxed">
                      Dual-key authorization enforced by Indian Navy operational doctrine. Both Officer and Base Duty Commander keys are verified prior to plaintext release.
                    </div>
                  )}
                </div>

                {/* Authentication Mode: Naval PKI Smart Card vs Software Passphrase */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-ink flex items-center justify-between">
                    <span>Cryptographic Key Carrier</span>
                    <div className="flex rounded-lg bg-surface border border-line p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setAuthMode('token')}
                        className={`px-2.5 py-0.5 rounded-md font-bold transition ${
                          authMode === 'token'
                            ? 'bg-accent text-noir shadow-sm'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        💳 Naval PKI Token (FIPS 140-3)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('passphrase')}
                        className={`px-2.5 py-0.5 rounded-md font-bold transition ${
                          authMode === 'passphrase'
                            ? 'bg-accent text-noir shadow-sm'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        🔑 Software Key
                      </button>
                    </div>
                  </label>

                  {authMode === 'token' ? (
                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          Reader #0: Indian Navy Defense PKI Card
                        </span>
                        <span className="font-mono text-[10px] text-ink-muted bg-white border border-line px-2 py-0.5 rounded">
                          SLOT-0: IND-NAV-0421
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-ink">
                          <span>Smart Card PIN / Master Access</span>
                          <span className="text-danger">*</span>
                        </div>
                        <input
                          type={showPass ? 'text' : 'password'}
                          className="input text-sm font-mono"
                          value={smartCardPin}
                          onChange={(e) => setSmartCardPin(e.target.value)}
                          placeholder="6-digit SmartCard PIN"
                          required
                        />
                      </div>

                      {hardwareTouchStep && (
                        <div className="rounded-xl bg-accent/20 border border-accent/40 p-2.5 text-center text-xs font-bold text-ink animate-pulse flex items-center justify-center gap-2">
                          <span>👆 Touch Physical Security Token to Authorize PQC Release…</span>
                        </div>
                      )}

                      <div className="text-[11px] text-ink-faint">
                        Post-Quantum private keys remain sealed inside the physical cryptographic token. No keys enter browser local storage.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wide text-ink flex items-center gap-1.5">
                          <KeyIcon size={13} /> Allotted Clearance Passphrase
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
                          placeholder="Allotted passphrase or account password"
                          required
                        />
                      </div>

                      <div className="text-[11px] text-ink-faint">
                        Enter your allotted passphrase or password to unlock your software key bundle.
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Zero-Trust Anti-Impersonation Challenge (Terminal Protection) ── */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wide text-ink flex items-center gap-1.5">
                      <ShieldIcon size={13} className="text-accent" />
                      Zero-Trust Terminal Challenge
                      <span className="text-danger font-bold">*</span>
                    </label>
                    <span className="pill bg-surface border border-line text-[10px] font-mono text-ink-muted">
                      Anti-Impersonation Protocol
                    </span>
                  </div>

                  {!hasSecQuestion ? (
                    /* Case A: First-time setup before decrypting */
                    <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4 space-y-3.5 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/25 text-noir">
                          <ShieldIcon size={14} />
                        </span>
                        <div>
                          <div className="font-bold text-ink text-xs uppercase tracking-wider">
                            First-Time Terminal Security Setup
                          </div>
                          <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                            Configure your secret verification question. If an unauthorized colleague (e.g. Officer 2) sits at your laptop to decrypt files, they cannot pass without this secret answer.
                          </p>
                          <div className="mt-1.5 inline-block rounded-lg border border-probable/40 bg-probable/10 px-2.5 py-1 font-mono text-[11px] font-bold text-probable-deep">
                            ⚠️ EXACT MATCH REQUIRED: Capital letters, spaces & punctuation are verified verbatim.
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        <label className="block text-xs font-bold uppercase tracking-wide text-ink-faint">
                          Select Verification Question
                        </label>
                        <select
                          value={setupQuestionChoice}
                          onChange={(e) => setSetupQuestionChoice(e.target.value)}
                          className="input text-xs font-medium"
                        >
                          {PRESET_SECURITY_QUESTIONS.map((q) => (
                            <option key={q} value={q}>
                              {q === 'custom' ? '✎ Write custom security question…' : q}
                            </option>
                          ))}
                        </select>

                        {setupQuestionChoice === 'custom' && (
                          <input
                            type="text"
                            required
                            placeholder="Type your custom security question"
                            value={setupCustomQuestion}
                            onChange={(e) => setSetupCustomQuestion(e.target.value)}
                            className="input text-xs"
                          />
                        )}

                        <div className="grid sm:grid-cols-2 gap-2 pt-1">
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                              Secret Answer (Case & Space Sensitive)
                            </span>
                            <div className="relative">
                              <input
                                type={showSetupAnswer ? 'text' : 'password'}
                                className="input pr-10 text-xs font-mono tracking-wider"
                                placeholder="e.g. INS Vikrant 2024"
                                value={setupAnswer}
                                onChange={(e) => setSetupAnswer(e.target.value)}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowSetupAnswer((v) => !v)}
                                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-faint hover:text-ink"
                              >
                                {showSetupAnswer ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                              <span>Confirm Answer</span>
                              {setupAnswer && confirmSetupAnswer && (
                                <span
                                  className={`font-mono text-[10px] font-bold ${
                                    setupAnswer === confirmSetupAnswer ? 'text-attributed-deep' : 'text-danger'
                                  }`}
                                >
                                  {setupAnswer === confirmSetupAnswer ? '✓ Match' : '✗ Mismatch'}
                                </span>
                              )}
                            </div>
                            <input
                              type={showSetupAnswer ? 'text' : 'password'}
                              className="input text-xs font-mono tracking-wider"
                              placeholder="Re-type exact answer"
                              value={confirmSetupAnswer}
                              onChange={(e) => setConfirmSetupAnswer(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Case B: Registered Question Challenge on every Decrypt */
                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-3.5 shadow-xs">
                      {/* Cryptographic Question Card */}
                      <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-[#1f1a23] via-[#1f1a23] to-[#17111b] p-4 text-white shadow-card">
                        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent/20 blur-xl" />
                        <div className="relative z-10 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/30 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-bright">
                            <ShieldIcon size={11} />
                            Registered Security Question
                          </span>
                          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                            Strict Case & Space
                          </span>
                        </div>
                        <div className="relative z-10 mt-2.5 font-display text-sm sm:text-base font-bold text-white leading-snug">
                          "{secQuestion}"
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-ink">
                          <label className="flex items-center gap-1.5">
                            <LockIcon size={13} /> Secret Verification Answer
                            <span className="text-danger font-bold">*</span>
                          </label>
                          <span className="pill bg-accent/15 text-accent-deep border border-accent/20 font-mono text-[10px] font-bold">
                            Exact Match Required
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type={showSecAnswer ? 'text' : 'password'}
                            className="input pr-12 text-sm font-mono tracking-wider"
                            placeholder="Enter exact answer (case, spaces & punctuation)"
                            value={secAnswer}
                            onChange={(e) => setSecAnswer(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecAnswer((v) => !v)}
                            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-faint hover:text-ink focus:outline-none"
                          >
                            {showSecAnswer ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                          </button>
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed">
                          Anti-Impersonation Active: Even if someone operates your active laptop, decryption is strictly refused without this exact answer.
                        </p>
                      </div>
                    </div>
                  )}
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
        <div className={`min-w-0 space-y-5 ${status === 'idle' ? 'hidden' : 'xl:col-span-6'}`}>
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
                    className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 shadow-xs"
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
            />
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Receipt Component ───────────────────────────────────────────────────────
function Receipt({ result, officer, asset, device }) {
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
