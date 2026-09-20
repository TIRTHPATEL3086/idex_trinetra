import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import Logo from '../components/Logo.jsx';
import { getHealth } from '../lib/api.js';
import { useAuth, ROLE_UI, ROLE_ORDER } from '../lib/auth.jsx';

/**
 * Sign-in.
 *
 * The left panel is not decoration: this system's whole claim is that it never
 * accuses someone it cannot prove, and the four roles are how that holds in
 * practice — the analyst who examines the evidence cannot mint a marked copy,
 * and the officer who holds clearance cannot investigate their own leak. Saying
 * so on the door is cheaper than explaining it afterwards.
 *
 * Responsive contract (holds from 320px up):
 *   - below lg: one column, form first, role reference collapsed underneath
 *   - lg and up: the brand panel and the form sit side by side in one card
 *   - inputs are 16px on mobile so iOS does not zoom the page on focus
 *   - no horizontal scroll at any width
 */
export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | working | error
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);

  // Where to go after signing in: back to whatever was being asked for, or the
  // landing screen the role actually has permission to see.
  const from = location.state?.from;

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

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

  const fillDemo = (role) => {
    const demo = ROLE_UI[role].demo;
    setForm({ email: demo.email, password: demo.password });
    setError(null);
    setStatus('idle');
  };

  return (
    <div className="grid min-h-[100dvh] w-full place-items-center bg-olive p-3 sm:p-5 lg:p-6">
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
              className="btn-lime h-12 w-full text-[15px]"
              disabled={status === 'working'}
            >
              {status === 'working' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <DemoAccounts onPick={fillDemo} />

          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <SystemStatus health={health} />
            <span className="text-[11px] text-ink-faint">SIH26237 · Provenance</span>
          </footer>
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
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#23260f] to-night p-11 text-white lg:flex">
      {/* soft lime bloom, purely atmospheric */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-lime/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-lime/10 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[30%] bg-lime">
            <FingerprintGlyph />
          </span>
          <span
            className="font-display leading-none"
            style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Provenance<span className="text-lime">.</span>
          </span>
        </div>

        <h2 className="mt-10 font-display text-[30px] font-extrabold leading-[1.15] tracking-tight">
          Four roles,
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
 * Collapsed by default. These are seed rows on a local database, and a judge
 * watching a ninety-second demo should not have to be told a password out loud.
 */
function DemoAccounts({ onPick }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 rounded-2xl border border-line bg-[#fbfbf7]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">
          Demo accounts
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          {open ? 'Hide' : 'Show'}
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <ul className="space-y-1.5 px-2.5 pb-2.5">
          {ROLE_ORDER.map((role) => {
            const meta = ROLE_UI[role];
            return (
              <li key={role}>
                <button
                  type="button"
                  onClick={() => onPick(role)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left transition hover:bg-line/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                >
                  <span
                    className={`pill shrink-0 ${meta.badge}`}
                    style={{ minWidth: 74, justifyContent: 'center' }}
                  >
                    {meta.short}
                  </span>
                  <span className="mono min-w-0 flex-1 truncate text-[11px] text-ink-muted">
                    {meta.demo.email}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-ink-faint">Use</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- status --- */

function SystemStatus({ health }) {
  const tone = !health
    ? { dot: 'bg-ink-faint', label: 'Checking…', text: 'text-ink-faint' }
    : !health.ok
      ? { dot: 'bg-inconclusive', label: 'API unreachable', text: 'text-inconclusive' }
      : health.warnings?.length
        ? { dot: 'bg-probable', label: 'Degraded', text: 'text-probable' }
        : { dot: 'bg-attributed', label: 'All systems go', text: 'text-attributed' };

  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-bold">
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
      <span className={tone.text}>{tone.label}</span>
    </span>
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
  const p = { fill: 'none', stroke: '#141410', strokeWidth: 1.7, strokeLinecap: 'round' };
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 13.2A7.5 7.5 0 0 1 19 10.5" {...p} />
      <path d="M19.6 13.5A7.6 7.6 0 0 1 18.9 17" {...p} />
      <path d="M7 12.4A5 5 0 0 1 16.9 12.1c0 1.6-.15 3.1-.5 4.6" {...p} />
      <path d="M7.2 15.8c.35 1.5.4 2.4.3 3.4" {...p} />
      <path d="M9.6 12a2.5 2.5 0 0 1 4.9.6c0 2.3-.3 4.6-1 6.8" {...p} />
      <path d="M10.7 19.9c.3-.9.5-1.7.7-2.6" {...p} />
      <circle cx="12" cy="12.3" r="1.15" fill="#141410" />
    </svg>
  );
}
