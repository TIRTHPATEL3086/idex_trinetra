import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { getHealth } from './lib/api.js';
import { useAuth, ROLE_UI, initialsOf } from './lib/auth.jsx';
import { RequireAuth, RequireCap } from './components/RequireAuth.jsx';
import Logo from './components/Logo.jsx';
import Login from './pages/Login.jsx';
import Assets from './pages/Assets.jsx';
import Decrypt from './pages/Decrypt.jsx';
import Trace from './pages/Trace.jsx';
import Timeline from './pages/Timeline.jsx';
import Robustness from './pages/Robustness.jsx';

/**
 * Application shell — a white, rounded app card sitting on a dark olive canvas,
 * with a lime accent and a chunky rounded logo, matching the reference design.
 *
 * Responsive contract (holds from 320px up):
 *   - below lg the sidebar is an off-canvas drawer opened from the top bar;
 *     from lg up it is a persistent column inside the card
 *   - no horizontal page scroll at any width
 *
 * Verdict colours stay semantic (green / amber / slate, never red).
 */

/**
 * Every screen names the capability it needs. The sidebar hides what the role
 * cannot reach and the router refuses it anyway — the same list drives both, so
 * a hidden link and a refused route can never disagree.
 */
const NAV = [
  { to: '/assets', label: 'Documents', icon: DocIcon, cap: 'assets:read' },
  { to: '/decrypt', label: 'Decrypt', icon: KeyIcon, cap: 'decrypt:self' },
  { to: '/trace', label: 'Trace', icon: SearchIcon, cap: 'trace:run' },
  { to: '/timeline', label: 'Timeline', icon: ClockIcon, cap: 'audit:own' },
  { to: '/robustness', label: 'Robustness', icon: ChartIcon, cap: 'metrics:read' },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

function Shell() {
  const { user, can } = useAuth();
  const health = useHealth();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  return (
    <div className="h-screen overflow-hidden bg-olive p-2 [height:100dvh] sm:p-4 lg:p-6">
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl bg-white shadow-app sm:rounded-3xl">
        {/* ---- top bar (fixed) ---- */}
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3.5 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
            className="btn-icon lg:hidden"
          >
            <MenuIcon />
          </button>

          {/* The wordmark costs ~125px the header cannot spare once the
              account control joins the row — below sm the tile alone carries it. */}
          <span className="sm:hidden">
            <Logo size="sm" iconOnly />
          </span>
          <span className="hidden sm:block">
            <Logo size="sm" />
          </span>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <HealthChip health={health} />
            <NotificationsBell health={health} />
            <WalletButton />
            <AccountMenu user={user} />
          </div>
        </header>

        {/* ---- body ---- */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {navOpen && (
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setNavOpen(false)}
              className="fixed inset-0 z-30 bg-night/40 backdrop-blur-sm lg:hidden"
            />
          )}

          <Sidebar health={health} open={navOpen} can={can} user={user} />

          <main className="scroll-slim min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <Routes>
                {/* Land on the first screen this role can actually use. */}
                <Route path="/" element={<Navigate to={user?.landing || '/assets'} replace />} />
                <Route
                  path="/login"
                  element={<Navigate to={user?.landing || '/assets'} replace />}
                />
                <Route
                  path="/assets"
                  element={
                    <RequireCap capability="assets:read">
                      <Assets />
                    </RequireCap>
                  }
                />
                <Route
                  path="/decrypt"
                  element={
                    <RequireCap capability="decrypt:self">
                      <Decrypt />
                    </RequireCap>
                  }
                />
                <Route
                  path="/trace"
                  element={
                    <RequireCap capability="trace:run">
                      <Trace />
                    </RequireCap>
                  }
                />
                <Route
                  path="/timeline"
                  element={
                    <RequireCap capability="audit:own">
                      <Timeline />
                    </RequireCap>
                  }
                />
                <Route
                  path="/robustness"
                  element={
                    <RequireCap capability="metrics:read">
                      <Robustness />
                    </RequireCap>
                  }
                />
                <Route path="*" element={<p className="text-ink-muted">No such screen.</p>} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ health, open, can, user }) {
  const items = NAV.filter((n) => can(n.cap));
  return (
    <aside
      className={`scroll-slim fixed inset-y-0 left-0 z-40 flex w-64 max-w-[82vw] flex-col overflow-y-auto border-r border-line bg-white p-4 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 ${
        open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}
    >
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <Logo size="sm" />
      </div>

      <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-ink-faint">
        Menu
      </div>
      <nav className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                isActive ? 'bg-night text-white' : 'text-ink-muted hover:bg-line/60 hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        {can('trace:run') && (
          <NavLink to="/trace" className="btn-dark w-full">
            <SearchIcon light />
            Trace a leak
          </NavLink>
        )}
        <RoleCard user={user} />
        <HealthBadge health={health} />
      </div>
    </aside>
  );
}

function useHealth() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      getHealth()
        .then((h) => alive && setHealth(h))
        .catch(() => alive && setHealth({ ok: false }));
    tick();
    const timer = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return health;
}

function healthTone(health) {
  if (!health) return { dot: 'bg-ink-faint', label: '…', tone: 'text-ink-faint' };
  if (!health.ok) return { dot: 'bg-inconclusive', label: 'API down', tone: 'text-inconclusive' };
  if (health.warnings?.length)
    return { dot: 'bg-probable', label: 'Degraded', tone: 'text-probable' };
  return { dot: 'bg-attributed', label: 'All systems go', tone: 'text-attributed' };
}

function HealthChip({ health }) {
  const { dot, label, tone } = healthTone(health);
  return (
    <span className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs font-bold sm:inline-flex">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className={tone}>{label}</span>
    </span>
  );
}

function HealthBadge({ health }) {
  if (!health) return null;
  const { dot, label, tone } = healthTone(health);
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-bold">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className={tone}>{label}</span>
      </div>
      {health.ok && (
        <dl className="mono mt-2.5 space-y-1 text-[11px] text-ink-muted">
          <Row k="database" v={health.db} good={health.db === 'up'} />
          <Row k="chain" v={health.chainMode} good={health.chain?.connected} />
          {health.warnings?.length > 0 && (
            <div className="pt-0.5 text-probable">{health.warnings.length} warning(s)</div>
          )}
        </dl>
      )}
    </div>
  );
}

function Row({ k, v, good }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{k}</dt>
      <dd className={good ? 'text-attributed' : 'text-inconclusive'}>{v}</dd>
    </div>
  );
}

/* -------------------------------------------------------------- account --- */

/**
 * The signed-in identity: avatar, role, sign out.
 *
 * Below `sm` only the avatar shows — the header already carries a menu button,
 * a bell and a wallet, and four labelled controls do not fit at 320px.
 */
function AccountMenu({ user }) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const meta = ROLE_UI[user?.role] ?? {};

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-1 transition hover:border-ink-faint sm:pr-3"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-night text-[11px] font-bold text-lime">
          {initialsOf(user.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[11px] font-bold leading-tight text-ink">{user.name}</span>
          <span className="block text-[10px] leading-tight text-ink-faint">{meta.short}</span>
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close account menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[17rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-3 shadow-panel">
            <div className="flex items-center gap-3 px-1 pb-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-night text-xs font-bold text-lime">
                {initialsOf(user.name)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-ink">{user.name}</div>
                <div className="truncate text-xs text-ink-muted">{user.email}</div>
              </div>
            </div>

            <div className="space-y-2 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  Role
                </span>
                <span className={`pill ${meta.badge ?? 'bg-line text-ink'}`}>{meta.short}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-muted">{meta.blurb}</p>

              {/* The hashed handle — the only identity that reaches the chain.
                  Shown here, deliberately apart from the name above it. */}
              <div className="rounded-xl bg-[#fbfbf7] px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                  On-chain handle
                </div>
                <div className="mono mt-0.5 break-all text-[10px] text-ink-muted">
                  {user.userRef}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="btn-ghost mt-3 w-full"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The role reminder pinned above the health badge in the sidebar. */
function RoleCard({ user }) {
  if (!user) return null;
  const meta = ROLE_UI[user.role] ?? {};
  return (
    <div className="rounded-2xl border border-line bg-[#fbfbf7] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
          Signed in as
        </span>
        <span className={`pill ${meta.badge ?? 'bg-line text-ink'}`}>{meta.short}</span>
      </div>
      <div className="mt-1.5 truncate text-xs font-bold text-ink">{user.name}</div>
      <div className="truncate text-[11px] text-ink-muted">{user.dept}</div>
    </div>
  );
}

/* ------------------------------------------------------------- wallet ----- */

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

/** Real MetaMask connect via window.ethereum. Degrades cleanly with no wallet. */
function WalletButton() {
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    // Reflect an already-authorised account without prompting.
    eth
      .request({ method: 'eth_accounts' })
      .then((a) => a?.[0] && setAccount(a[0]))
      .catch(() => {});
    const onChange = (a) => setAccount(a?.[0] ?? null);
    eth.on?.('accountsChanged', onChange);
    return () => eth.removeListener?.('accountsChanged', onChange);
  }, []);

  async function connect() {
    const eth = window.ethereum;
    if (!eth) {
      window.open('https://metamask.io/download/', '_blank', 'noopener');
      return;
    }
    setBusy(true);
    try {
      const a = await eth.request({ method: 'eth_requestAccounts' });
      setAccount(a?.[0] ?? null);
    } catch {
      /* user rejected — leave disconnected */
    } finally {
      setBusy(false);
    }
  }

  if (account) {
    return (
      <button
        type="button"
        onClick={() => setAccount(null)}
        title="Click to disconnect"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-ink"
      >
        <span className="h-2 w-2 rounded-full bg-attributed" />
        <span className="mono">{short(account)}</span>
      </button>
    );
  }

  return (
    <button type="button" onClick={connect} className="btn-dark !px-4" disabled={busy}>
      <WalletIcon />
      <span className="hidden sm:inline">{busy ? 'Connecting…' : 'Connect'}</span>
    </button>
  );
}

/* ----------------------------------------------------- notifications ------ */

/** Bell with a popover of live system status / warnings. */
function NotificationsBell({ health }) {
  const [open, setOpen] = useState(false);
  const warnings = health?.warnings ?? [];
  const count = warnings.length;

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-icon relative"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-probable text-[9px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-line bg-white p-3 shadow-panel">
            <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-ink-faint">
              System status
            </div>
            {count === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-attributed/10 px-3 py-2.5 text-sm text-attributed">
                <span className="h-2 w-2 rounded-full bg-attributed" />
                All systems operational
              </div>
            ) : (
              <ul className="space-y-1.5">
                {warnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-xl bg-probable/10 px-3 py-2 text-xs text-ink"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-probable" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- icons -- */
const S = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function NavIcon({ children, active, light }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className={light || active ? 'text-current' : 'text-ink-faint group-hover:text-ink-muted'}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
function DocIcon(p) {
  return (
    <NavIcon {...p}>
      <path d="M6 3h8l4 4v14H6V3Z" {...S} />
      <path d="M14 3v4h4M9 12h6M9 16h6" {...S} />
    </NavIcon>
  );
}
function KeyIcon(p) {
  return (
    <NavIcon {...p}>
      <circle cx="8" cy="8" r="4" {...S} />
      <path d="m11 11 8 8M16 16l2-2M18 18l2-2" {...S} />
    </NavIcon>
  );
}
function SearchIcon(p) {
  return (
    <NavIcon {...p}>
      <circle cx="11" cy="11" r="6" {...S} />
      <path d="m20 20-3.5-3.5" {...S} />
    </NavIcon>
  );
}
function ClockIcon(p) {
  return (
    <NavIcon {...p}>
      <circle cx="12" cy="12" r="8.5" {...S} />
      <path d="M12 7.5V12l3 2" {...S} />
    </NavIcon>
  );
}
function ChartIcon(p) {
  return (
    <NavIcon {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...S} />
    </NavIcon>
  );
}
function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" {...S} />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM9.5 20a2.5 2.5 0 0 0 5 0" {...S} />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="#fff"
        strokeWidth="1.8"
      />
      <path
        d="M3 7V6a2 2 0 0 1 2-2h11M16 13h2"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
