import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { getHealth } from './lib/api.js';
import Assets from './pages/Assets.jsx';
import Decrypt from './pages/Decrypt.jsx';
import Trace from './pages/Trace.jsx';
import Timeline from './pages/Timeline.jsx';
import Robustness from './pages/Robustness.jsx';

/**
 * Application shell: navigation, header, and a live health indicator.
 *
 * Responsive contract (must hold at every width from 320px up):
 *   - below lg the sidebar is an off-canvas drawer opened by the header button;
 *     from lg up it is a persistent column
 *   - no horizontal page scroll at any width
 *   - the header, nav and content reflow rather than shrinking to fit
 *
 * Two display conventions the screens inherit:
 *   - verdict colours are emerald / amber / slate, never red
 *   - on-chain (hashed) and registry (real name) values are shown as separate,
 *     labelled groups
 */

const NAV = [
  { to: '/assets', label: 'Assets' },
  { to: '/decrypt', label: 'Decrypt' },
  { to: '/trace', label: 'Trace' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/robustness', label: 'Robustness' },
];

export default function App() {
  const health = useHealth();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Backdrop — only present while the drawer is open, below lg. */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      <Sidebar health={health} open={navOpen} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-100 lg:hidden"
          >
            <MenuIcon />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-slate-300">
            Decryption Provenance Register
          </h1>

          {/* TODO: MetaMask connect (wagmi + viem) for wallet-signed receipts. */}
          <button
            type="button"
            className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
          >
            <span className="hidden sm:inline">Connect wallet</span>
            <span className="sm:hidden">Connect</span>
          </button>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Routes>
              <Route path="/" element={<Navigate to="/assets" replace />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/decrypt" element={<Decrypt />} />
              <Route path="/trace" element={<Trace />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/robustness" element={<Robustness />} />
              <Route path="*" element={<p className="text-slate-500">No such screen.</p>} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ health, open }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-900 p-5 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 lg:bg-slate-900/60 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="mb-8">
        <div className="text-sm font-semibold tracking-wide text-slate-100">PROVENANCE</div>
        <div className="mono mt-0.5 text-[11px] text-slate-500">Decryption Register</div>
      </div>

      <nav className="space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2.5 text-sm transition ${
                isActive
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <HealthBadge health={health} />
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

/** Surfaces anything degraded — a dead DB or an unreachable RPC — at a glance. */
function HealthBadge({ health }) {
  if (!health) return null;

  const dot = !health.ok
    ? 'bg-inconclusive'
    : health.warnings?.length
      ? 'bg-probable'
      : 'bg-attributed';

  return (
    <div className="mono mt-auto space-y-1.5 border-t border-slate-800 pt-4 text-[11px] text-slate-500">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span>{health.ok ? 'api up' : 'api down'}</span>
      </div>
      {health.ok && (
        <>
          <div>db {health.db}</div>
          <div>chain {health.chainMode}</div>
          {health.warnings?.length > 0 && (
            <div className="text-probable">{health.warnings.length} warning(s)</div>
          )}
        </>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
