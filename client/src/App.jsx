import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { getHealth } from './lib/api.js';
import Assets from './pages/Assets.jsx';
import Decrypt from './pages/Decrypt.jsx';
import Trace from './pages/Trace.jsx';
import Timeline from './pages/Timeline.jsx';
import Robustness from './pages/Robustness.jsx';

/**
 * C1 — the shell. Owner: Person C, who owns this entire folder.
 *
 * This is a skeleton, not the finished design. It exists so the routes, the API
 * client and the dev proxy are already wired and C can start on screens at
 * Hour 0 instead of scaffolding. Replace the styling freely — but keep:
 *   - the verdict colours (emerald / amber / slate, never red)
 *   - the visual split between "On-chain (hashed)" and "Internal registry"
 * Both are graded, and both are in docs/CONTRACTS.md.
 */

const NAV = [
  { to: '/assets', label: 'Assets', hint: 'C2' },
  { to: '/decrypt', label: 'Decrypt', hint: 'C3' },
  { to: '/trace', label: 'Trace', hint: 'C5' },
  { to: '/timeline', label: 'Timeline', hint: 'C6' },
  { to: '/robustness', label: 'Robustness', hint: 'C7' },
];

export default function App() {
  const health = useHealth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-8">
          <div className="text-sm font-semibold tracking-wide text-slate-100">PROVENANCE</div>
          <div className="mono mt-0.5 text-[11px] text-slate-500">SIH26237</div>
        </div>

        <nav className="space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`
              }
            >
              <span>{item.label}</span>
              <span className="mono text-[10px] text-slate-600">{item.hint}</span>
            </NavLink>
          ))}
        </nav>

        <HealthBadge health={health} />
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-slate-800 px-8 py-4">
          <h1 className="text-sm font-medium text-slate-300">Decryption Provenance Register</h1>
          {/* C: MetaMask connect button goes here (C1 / §7.3). */}
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
    const t = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return health;
}

/**
 * Small, but keep it. `coreFallback` being non-empty means the backend is
 * running stand-ins instead of Person A's real watermark — you want to notice
 * that here, not on stage.
 */
function HealthBadge({ health }) {
  if (!health) return null;

  const dot = health.ok ? (health.warnings?.length ? 'bg-probable' : 'bg-attributed') : 'bg-inconclusive';

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
          {health.mockMode && <div className="text-probable">mocks on</div>}
          {health.coreFallback?.length > 0 && (
            <div className="text-probable">core fallback ×{health.coreFallback.length}</div>
          )}
        </>
      )}
    </div>
  );
}
