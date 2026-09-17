import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { getHealth } from './lib/api.js';
import Logo from './components/Logo.jsx';
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

const NAV = [
  { to: '/assets', label: 'Documents', icon: DocIcon },
  { to: '/decrypt', label: 'Decrypt', icon: KeyIcon },
  { to: '/trace', label: 'Trace', icon: SearchIcon },
  { to: '/timeline', label: 'Timeline', icon: ClockIcon },
  { to: '/robustness', label: 'Robustness', icon: ChartIcon },
];

export default function App() {
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
    <div className="min-h-screen bg-olive p-2 sm:p-4 lg:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl bg-white shadow-app sm:min-h-[calc(100vh-2rem)] sm:rounded-3xl lg:min-h-[calc(100vh-3rem)]">
        {/* ---- top bar ---- */}
        <header className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
            className="btn-icon lg:hidden"
          >
            <MenuIcon />
          </button>

          <Logo size="sm" />

          <div className="ml-auto flex items-center gap-2">
            <HealthChip health={health} />
            <NotificationsBell health={health} />
            <WalletButton />
          </div>
        </header>

        {/* ---- body ---- */}
        <div className="flex min-h-0 flex-1">
          {navOpen && (
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setNavOpen(false)}
              className="fixed inset-0 z-30 bg-night/40 backdrop-blur-sm lg:hidden"
            />
          )}

          <Sidebar health={health} open={navOpen} />

          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <Routes>
                <Route path="/" element={<Navigate to="/assets" replace />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/decrypt" element={<Decrypt />} />
                <Route path="/trace" element={<Trace />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/robustness" element={<Robustness />} />
                <Route path="*" element={<p className="text-ink-muted">No such screen.</p>} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ health, open }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[82vw] flex-col border-r border-line bg-white p-4 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 ${
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
        {NAV.map(({ to, label, icon: Icon }) => (
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
        <NavLink to="/trace" className="btn-dark w-full">
          <SearchIcon light />
          Trace a leak
        </NavLink>
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
