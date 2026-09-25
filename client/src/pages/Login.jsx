import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CheckIcon, ChevronLeftIcon, KeyIcon, ShieldIcon } from '../components/icons.jsx';

import Logo from '../components/Logo.jsx';
import { useAuth, DEMO_ACCOUNTS } from '../lib/auth.jsx';

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
    setMenuRole(acc.role);
  };

  // The demo list is driven from two places — the role bar above the card and
  // the drop-up under the form — so its state lives here.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRole, setMenuRole] = useState(null); // null = the role step
  const activeAccount = DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === form.email.trim().toLowerCase()
  );

  // A role with one account fills the form at once; one with several opens
  // the drop-up on that role's accounts.
  const chooseRole = (role) => {
    const group = ROLE_GROUPS.find((g) => g.role === role);
    setMenuRole(role);
    if (group.accounts.length === 1) {
      fillDemo(group.accounts[0]);
      setMenuOpen(false);
    } else {
      setMenuOpen(true);
    }
  };

  return (
    <div className="relative grid min-h-[100dvh] w-full place-items-center bg-shell p-3 sm:p-5 lg:p-6">
      {/* A real route home, not history.back() — someone who opened /login
          directly, or followed a stale link, has no history to go back to. */}
      <Link
        to="/"
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-[13px] font-medium text-ink-muted shadow-sm transition hover:border-ink-faint hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 sm:left-6 sm:top-6"
      >
        <ChevronLeftIcon size={14} />
        Back
      </Link>

      <div className="flex w-full max-w-[1080px] flex-col items-center gap-4 pt-14 sm:gap-5 sm:pt-16">
        {/* The role just chosen wins over the account still in the form, so
            tapping Officer lights Officer before an officer is picked. */}
        <RoleBar active={menuRole ?? activeAccount?.role} onChoose={chooseRole} />

        <main className="w-full rounded-2xl bg-white shadow-app sm:rounded-3xl lg:grid lg:grid-cols-[1.02fr_1fr]">
          <BrandPanel />

          {/* ------------------------------------------------------ the form -- */}
          <section className="flex flex-col justify-center px-5 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12">
            {/* Mobile-only brand row — the panel beside it is hidden at this width. */}
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
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    // A typed address speaks for itself; drop the chosen role.
                    setMenuRole(null);
                  }}
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

            <DemoAccounts
              onPick={fillDemo}
              activeAccount={activeAccount}
              open={menuOpen}
              setOpen={setMenuOpen}
              role={menuRole}
              setRole={setMenuRole}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ left panel -- */

/**
 * Hidden below `lg`. On a phone the form is the whole job, and a tall
 * decorative panel above it just pushes the fields off the first screen.
 */
/** The three things this system does, in the order it does them. */
const SUMMARY = [
  {
    title: 'Release',
    body: 'A copy is marked for its recipient before it is handed over.',
    dot: 'bg-chromia-purple-500',
  },
  {
    title: 'Anchor',
    body: 'Its receipt is written to a public ledger, ahead of the copy existing.',
    dot: 'bg-chromia-green-500',
  },
  {
    title: 'Trace',
    body: 'A leaked file is matched back to the release it came from.',
    dot: 'bg-chromia-yellow-500',
  },
];

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden rounded-l-3xl bg-gradient-to-br from-[#0d1117] to-noir p-11 text-white lg:flex">
      {/* The artwork is merged into the panel rather than placed on it.
          `screen` is what does the work: the render's near-black background
          becomes nothing against the panel, so only its glow survives and
          there is no rectangle edge to see. A radial mask then dissolves what
          is left toward the top-left, where the heading needs a clean field. */}
      <img
        src="/secure-document.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -right-[48%] w-[135%] max-w-none select-none opacity-60 mix-blend-screen"
        style={{
          maskImage:
            'radial-gradient(82% 74% at 46% 60%, #000 34%, rgba(0,0,0,0.72) 62%, transparent 88%)',
          WebkitMaskImage:
            'radial-gradient(82% 74% at 46% 60%, #000 34%, rgba(0,0,0,0.72) 62%, transparent 88%)',
        }}
      />

      {/* Two soft washes rather than one hard edge: the first keeps the
          wordmark and headline dark at the top, the second holds the reading
          column on the left clear of the glow. Neither draws a visible line. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-noir-deep via-noir-deep/40 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-noir-deep from-0% via-noir-deep/85 via-55% to-transparent"
      />

      {/* The seam. Without this the dark panel simply stops against the white
          form and the card reads as two boxes; fading the edge to the form's
          own colour lets the halves meet instead of abut. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-40 bg-gradient-to-r from-transparent via-white/45 to-white"
      />

      {/* soft accent bloom, purely atmospheric */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative z-10 [text-shadow:0_1px_14px_rgba(15,10,20,0.75)]">
        <Logo size="md" onDark />

        {/* What the product is, in three lines. Someone at a sign-in screen
            wants to know what they are signing in to — not how the roles are
            split, which only matters once they are inside. */}
        <h2 className="mt-10 font-display text-[32px] leading-[1.08] text-white">
          The register for
          <br />
          <span className="text-accent">released documents.</span>
        </h2>
        <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-white/85">
          Every protected file that leaves this system is marked for the person who opened it and
          receipted on a public ledger — so a copy that surfaces somewhere it should not can be
          traced back to a single release.
        </p>
      </div>

      <ul className="relative z-10 mt-9 space-y-4 [text-shadow:0_1px_14px_rgba(15,10,20,0.75)]">
        {SUMMARY.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-white">{item.title}</div>
              <div className="text-xs leading-relaxed text-white/75">{item.body}</div>
            </div>
          </li>
        ))}
      </ul>

      <p className="relative z-10 mt-6 text-[11px] leading-relaxed text-white/60">
        No name, department or device ever reaches the ledger — only a salted hash of the account.
      </p>
    </aside>
  );
}

/* -------------------------------------------------------- demo accounts --- */

/**
 * Demo accounts selector.
 *
 * A two-step drop-up: first the role, then the account inside it. A role with
 * a single account fills the form straight away, so there is no pointless
 * second step. The list floats over the form above the trigger rather than
 * opening inside the card, so the sign-in box keeps its size. A click outside
 * or Escape closes it; Escape on the account step goes back to the roles.
 */
const ROLE_GROUPS = [
  { role: 'ADMIN', label: 'Admin', hint: 'Registry, officers and custody' },
  { role: 'OFFICER', label: 'Officer', hint: 'Opens released documents' },
  { role: 'INVESTIGATOR', label: 'Investigator', hint: 'Traces leaks, cannot decrypt' },
]
  .map((g) => ({ ...g, accounts: DEMO_ACCOUNTS.filter((a) => a.role === g.role) }))
  .filter((g) => g.accounts.length > 0);

/**
 * The role bar above the card: one segment per role, the active one lifted
 * into a pill. It sits in the page flow, centred, so on a phone it lands under
 * the Back button instead of colliding with it.
 */
const ROLE_ICONS = { ADMIN: ShieldIcon, OFFICER: KeyIcon, INVESTIGATOR: SearchIcon };

function RoleBar({ active, onChoose }) {
  return (
    <div
      role="group"
      aria-label="Demo role"
      className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-line bg-white/80 p-1 shadow-app backdrop-blur min-[360px]:gap-1 min-[360px]:p-1.5"
    >
      {ROLE_GROUPS.map((g) => {
        const Icon = ROLE_ICONS[g.role];
        const on = active === g.role;
        return (
          <button
            key={g.role}
            type="button"
            aria-pressed={on}
            onClick={() => onChoose(g.role)}
            className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-[12.5px] font-semibold min-[360px]:gap-2 min-[360px]:px-3.5 min-[360px]:text-[13px] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 sm:px-5 sm:text-sm ${
              on
                ? 'bg-accent/25 text-ink shadow-sm ring-1 ring-accent/60'
                : 'text-ink-muted hover:bg-line/40 hover:text-ink'
            }`}
          >
            <Icon size={16} />
            {g.label}
            {/* the underline glow under the active segment */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-4 -bottom-1.5 h-0.5 rounded-full bg-accent transition-opacity ${
                on ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function DemoAccounts({ onPick, activeAccount, open, setOpen, role, setRole }) {
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  const group = ROLE_GROUPS.find((g) => g.role === role);

  const pick = (acc) => {
    onPick(acc);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (role) {
        setRole(null);
      } else {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, role, setOpen, setRole]);

  const rowClass = (highlight) =>
    `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
      highlight
        ? 'bg-line/60 shadow-sm ring-1 ring-accent/70'
        : 'bg-white hover:bg-line/40 hover:shadow-sm'
    }`;
  const actionClass =
    'shrink-0 rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-ink-muted transition group-hover:border-accent group-hover:bg-accent group-hover:text-noir';

  return (
    <div ref={rootRef} className="relative mt-6">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          // A fresh open goes straight to the chosen role's accounts when it
          // has several to pick from, and to the role step otherwise.
          if (!open) {
            const g = ROLE_GROUPS.find((x) => x.role === (activeAccount?.role ?? role));
            setRole(g && g.accounts.length > 1 ? g.role : null);
          }
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-surface px-4 py-3 text-left transition hover:bg-line/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 ${
          open ? 'border-accent' : 'border-line'
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-ink-faint">
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
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-muted">
          {activeAccount ? 'Change' : 'Choose'}
          {/* Points the way the list opens: up, then down to close. */}
          <ChevronIcon open={!open} />
        </span>
      </button>

      {/* Kept mounted so it can animate both ways; hidden from focus and
          assistive tech while closed. */}
      <div
        aria-hidden={!open}
        inert={open ? undefined : ''}
        className={`absolute inset-x-0 bottom-full z-30 mb-2 max-h-[min(60vh,380px)] origin-bottom overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-panel transition-[opacity,transform,visibility] duration-200 ease-out ${
          open
            ? 'visible translate-y-0 scale-100 opacity-100'
            : 'invisible translate-y-2 scale-[0.97] opacity-0'
        }`}
      >
        {!group ? (
          <>
            <p className="px-3 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              Choose a role
            </p>
            <ul className="space-y-1.5">
              {ROLE_GROUPS.map((g) => {
                const single = g.accounts.length === 1;
                const holdsActive = g.accounts.some((a) => a.email === activeAccount?.email);
                return (
                  <li key={g.role}>
                    <button
                      type="button"
                      onClick={() => (single ? pick(g.accounts[0]) : setRole(g.role))}
                      className={rowClass(holdsActive)}
                    >
                      <span
                        className={`pill shrink-0 ${g.accounts[0].badge}`}
                        style={{ minWidth: 96, justifyContent: 'center' }}
                      >
                        {g.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-ink">{g.hint}</div>
                        <div className="truncate text-[11px] text-ink-muted">
                          {single
                            ? g.accounts[0].email
                            : `${g.accounts.length} accounts to choose from`}
                        </div>
                      </div>
                      <span className={actionClass}>
                        {single ? (
                          'Use'
                        ) : (
                          <span className="flex items-center gap-0.5">
                            Open <ChevronRight />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-1 pb-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setRole(null)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-muted transition hover:bg-line/40 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronLeftIcon size={13} />
                Roles
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                {group.label} accounts
              </span>
            </div>
            <ul className="space-y-1.5">
              {group.accounts.map((acc) => {
                const isSelected = activeAccount?.email === acc.email;
                return (
                  <li key={acc.email}>
                    <button
                      type="button"
                      onClick={() => pick(acc)}
                      className={rowClass(isSelected)}
                    >
                      <span
                        className={`pill shrink-0 ${acc.badge}`}
                        style={{ minWidth: 80, justifyContent: 'center' }}
                      >
                        {acc.short}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mono truncate text-[12px] font-bold text-ink">
                          {acc.email}
                        </div>
                        <div className="truncate text-[11px] text-ink-muted">
                          {acc.name} ·{' '}
                          <span className="font-semibold text-ink-faint">{acc.dept}</span>
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[11px] font-extrabold text-noir shadow-xs">
                          <span className="flex items-center gap-1">
                            In Use <CheckIcon size={11} />
                          </span>
                        </span>
                      ) : (
                        <span className={actionClass}>Use</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" {...S} />
    </svg>
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

function SearchIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" {...S} />
      <path d="m20 20-4.4-4.4" {...S} />
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
