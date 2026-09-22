import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckIcon } from '../components/icons.jsx';

import Logo from '../components/Logo.jsx';
import { useAuth, ROLE_UI, ROLE_ORDER, DEMO_ACCOUNTS } from '../lib/auth.jsx';

/**
 * Sign-in.
 *
 * The left panel highlights the separation of duties:
 * Admin, Officer, and Investigator.
 */
export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | working | error
  const [error, setError] = useState(null);

  // Where to go after signing in: back to whatever was being asked for, or the
  // landing screen the role actually has permission to see.
  const from = location.state?.from;

  useEffect(() => {
    if (user) navigate(from || user.landing || '/assets', { replace: true });
  }, [user, from, navigate]);

  async function submit(e) {
    e.preventDefault();
    setStatus('working');
    setError(null);
    try {
      const signedIn = await signIn(form.email.trim(), form.password);
      navigate(from || signedIn.landing || '/assets', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in.');
      setStatus('error');
    }
  }

  const fillDemo = (acc) => {
    setForm({ email: acc.email, password: acc.password });
    setError(null);
    setStatus('idle');
  };

  return (
    <div className="grid min-h-[100dvh] w-full place-items-center bg-canvas p-3 sm:p-5 lg:p-6">
      <main className="w-full max-w-[1080px] overflow-hidden rounded-2xl bg-white shadow-app sm:rounded-3xl lg:grid lg:grid-cols-[1.02fr_1fr]">
        <BrandPanel />

        {/* ------------------------------------------------------ the form -- */}
        <section className="flex flex-col justify-center px-5 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12">
          {/* Mobile-only brand row — the panel above is hidden at this width. */}
          <div className="mb-7 lg:hidden">
            <Logo size="sm" />
          </div>

          <header className="mb-6">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
              Sign in
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Every release and every investigation is recorded against the account that ran it.
            </p>
          </header>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck="false"
                required
                className="input text-base sm:text-sm"
                placeholder="name@example.gov"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  className="input pr-12 text-base sm:text-sm"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-ink-faint transition hover:text-ink focus:outline-none focus-visible:text-ink"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-probable/10 px-3.5 py-2.5 text-sm text-ink"
              >
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-probable" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              className="btn-accent h-12 w-full text-[15px]"
              disabled={status === 'working'}
            >
              {status === 'working' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <DemoAccounts onPick={fillDemo} currentEmail={form.email} />
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ left panel -- */

/**
 * Hidden below `lg`. On a phone the form is the whole job, and a tall
 * decorative panel above it just pushes the fields off the first screen.
 */
function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0d1117] to-noir p-11 text-white lg:flex">
      {/* soft accent bloom, purely atmospheric */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[30%] bg-accent">
            <FingerprintGlyph />
          </span>
          <span
            className="font-display leading-none"
            style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Provenance<span className="text-accent">.</span>
          </span>
        </div>

        <h2 className="mt-10 font-display text-[30px] font-extrabold leading-[1.15] tracking-tight">
          Three roles,
          <br />
          on purpose.
        </h2>
        <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-white/60">
          The analyst who examines a leak cannot release a marked copy. The officer who holds
          clearance cannot investigate their own. Nobody holds both halves by accident.
        </p>
      </div>

      <ul className="relative mt-9 space-y-3">
        {ROLE_ORDER.map((role) => (
          <li key={role} className="flex items-start gap-3">
            <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${ROLE_UI[role].tint}`} />
            <div className="min-w-0">
              <div className="text-[13px] font-bold">{ROLE_UI[role].label}</div>
              <div className="text-xs leading-relaxed text-white/50">{ROLE_UI[role].blurb}</div>
            </div>
          </li>
        ))}
      </ul>

      <p className="relative mt-9 text-[11px] leading-relaxed text-white/35">
        No name, department or device label ever reaches the blockchain — only keccak256(userId ‖
        salt).
      </p>
    </aside>
  );
}

/* -------------------------------------------------------- demo accounts --- */

/**
 * Demo accounts selector.
 * Clicking 'Use' automatically closes the list smoothly and highlights
 * the selected role chip (Admin, Officer, or Investigator) right beside the label.
 */
function DemoAccounts({ onPick, currentEmail }) {
  const [open, setOpen] = useState(false);

  const activeAccount = DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === (currentEmail || '').trim().toLowerCase()
  );

  return (
    <div className="mt-6 rounded-2xl border border-line bg-[#faf8f5] transition-all">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-line/20 rounded-2xl"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-faint shrink-0">
            Demo accounts
          </span>
          {activeAccount && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${activeAccount.badge} shadow-xs`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              In use: {activeAccount.short} ({activeAccount.dept})
            </span>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted shrink-0">
          {open ? 'Hide' : activeAccount ? 'Change' : 'Show'}
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <ul className="space-y-1.5 px-2.5 pb-2.5">
          {DEMO_ACCOUNTS.map((acc) => {
            const isSelected = activeAccount?.email === acc.email;
            return (
              <li key={acc.email}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(acc);
                    setOpen(false); // Automatically close dropdown on click!
                  }}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected
                      ? 'bg-line/60 ring-1 ring-accent/70 shadow-sm'
                      : 'bg-white hover:bg-line/40 hover:shadow-sm'
                  }`}
                >
                  <span
                    className={`pill shrink-0 ${acc.badge}`}
                    style={{ minWidth: 80, justifyContent: 'center' }}
                  >
                    {acc.short}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mono truncate text-[12px] font-bold text-ink">{acc.email}</div>
                    <div className="truncate text-[11px] text-ink-muted">
                      {acc.name} · <span className="font-semibold text-ink-faint">{acc.dept}</span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                      isSelected
                        ? 'bg-accent text-noir font-extrabold shadow-xs'
                        : 'border border-line bg-[#faf8f5] text-ink-muted group-hover:border-accent group-hover:bg-accent group-hover:text-noir'
                    }`}
                  >
                    {isSelected ? (
                      <span className="flex items-center gap-1">
                        In Use <CheckIcon size={11} />
                      </span>
                    ) : (
                      'Use'
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- icons --- */

const S = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
};

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...S} />
      <circle cx="12" cy="12" r="3" {...S} />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4l16 16" {...S} />
      <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8" {...S} />
      <path d="M6.4 7.9A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.8-.5" {...S} />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" {...S} />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" {...S} />
    </svg>
  );
}

/** The logo glyph, drawn here so the panel does not depend on Logo's layout. */
function FingerprintGlyph() {
  const p = { fill: 'none', stroke: '#0f151d', strokeWidth: 1.7, strokeLinecap: 'round' };
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 13.2A7.5 7.5 0 0 1 19 10.5" {...p} />
      <path d="M19.6 13.5A7.6 7.6 0 0 1 18.9 17" {...p} />
      <path d="M7 12.4A5 5 0 0 1 16.9 12.1c0 1.6-.15 3.1-.5 4.6" {...p} />
      <path d="M7.2 15.8c.35 1.5.4 2.4.3 3.4" {...p} />
      <path d="M9.6 12a2.5 2.5 0 0 1 4.9.6c0 2.3-.3 4.6-1 6.8" {...p} />
      <path d="M10.7 19.9c.3-.9.5-1.7.7-2.6" {...p} />
      <circle cx="12" cy="12.3" r="1.15" fill="#0f151d" />
    </svg>
  );
}
