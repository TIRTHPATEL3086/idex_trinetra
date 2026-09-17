import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { getHealth } from './lib/api.js';
import Assets from './pages/Assets.jsx';
import Decrypt from './pages/Decrypt.jsx';
import Trace from './pages/Trace.jsx';
import Timeline from './pages/Timeline.jsx';
import Robustness from './pages/Robustness.jsx';

/**
 * Application shell: sidebar navigation, header, and a live health indicator.
 *
 * Two conventions the screens inherit and should not break:
 *   - verdict colours are emerald / amber / slate, never red
 *   - on-chain values (hashed) and registry values (real names) are always
 *     rendered as separate, labelled groups
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

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/60 p-5">
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
                `block rounded-md px-3 py-2 text-sm transition ${
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

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-slate-800 px-8 py-4">
          <h1 className="text-sm font-medium text-slate-300">Decryption Provenance Register</h1>
          {/* TODO: MetaMask connect (wagmi + viem) for wallet-signed receipts. */}
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
          >
            Connect wallet
          </button>
        </header>

        <div className="p-8">
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
    <div className="mono mt-8 space-y-1.5 border-t border-slate-800 pt-4 text-[11px] text-slate-500">
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
