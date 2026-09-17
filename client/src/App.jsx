import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Shield,
  FileText,
  Key,
  Fingerprint,
  History,
  Activity,
  Wallet,
  Play,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Radio,
  ExternalLink,
} from 'lucide-react';

import { getHealth, isDemoMode, setDemoMode, shortHash } from './lib/api.js';
import Assets from './pages/Assets.jsx';
import Decrypt from './pages/Decrypt.jsx';
import Trace from './pages/Trace.jsx';
import Timeline from './pages/Timeline.jsx';
import Robustness from './pages/Robustness.jsx';

import DemoScriptModal from './components/DemoScriptModal.jsx';
import WalletModal from './components/WalletModal.jsx';

const NAV = [
  { to: '/assets', label: 'Assets Register', icon: FileText },
  { to: '/decrypt', label: 'Decrypt & Anchor', icon: Key },
  { to: '/trace', label: 'Forensic Trace', icon: Fingerprint },
  { to: '/timeline', label: 'Audit Timeline', icon: History },
  { to: '/robustness', label: 'Robustness Metrics', icon: Activity },
];

export default function App() {
  const health = useHealth();
  const [demoMode, setDemoModeState] = useState(isDemoMode());
  const [demoScriptOpen, setDemoScriptOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const [signingMode, setSigningMode] = useState('server');
  const [walletState, setWalletState] = useState({
    connected: true,
    address: '0x71C6634C25317bB832dbb8382c753fA7B20',
    network: 'Sepolia (ChainID: 11155111)',
    balance: '1.450 SepoliaETH',
  });

  const toggleDemoMode = () => {
    const next = !demoMode;
    setDemoMode(next);
    setDemoModeState(next);
  };

  return (
    <div className="flex min-h-screen bg-[#070b12] text-slate-200">
      {/* Sidebar Navigation */}
      <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-slate-950/70 p-5 flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="mb-7">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-wider text-slate-100">PROVENANCE</div>
                <div className="mono text-[10px] text-cyan-400/80">SIH26237 // Crypto Register</div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* 60-Second Demo Kit Quick-Trigger */}
          <div className="mt-8 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-cyan-300">
              <Play className="h-3.5 w-3.5" />
              <span>Demo Walkthrough Kit</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              60-second timed pitch script with Hinglish dialogue & jury viva defense.
            </p>
            <button
              type="button"
              onClick={() => setDemoScriptOpen(true)}
              className="mt-2.5 w-full rounded-md bg-cyan-600/80 hover:bg-cyan-600 py-1.5 text-[11px] font-medium text-white shadow transition"
            >
              Open 60s Demo Script
            </button>
          </div>
        </div>

        {/* System Health Status in Sidebar Footer */}
        <HealthBadge health={health} demoMode={demoMode} />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-x-hidden">
        {/* Top Command Bar */}
        <header className="flex flex-wrap items-center justify-between border-b border-slate-800/80 bg-slate-950/40 px-8 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h1 className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
              Decryption Provenance Security Console
            </h1>
            <span className="hidden md:inline-block h-3 w-px bg-slate-800" />
            <div className="hidden md:flex items-center gap-2 text-[11px] mono text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Chain: Sepolia (#5829301)</span>
              <span>·</span>
              <span>DWT Δ=12</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Dual-Engine Mode Toggle (Live API vs Standalone Mock) */}
            <button
              type="button"
              onClick={toggleDemoMode}
              title="Toggle between standalone in-memory demo engine and live Express backend"
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                demoMode
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className={`h-3 w-3 ${demoMode ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{demoMode ? 'Demo Engine (Offline-Safe)' : 'Live Backend API'}</span>
            </button>

            {/* Wallet Connect Button */}
            <button
              type="button"
              onClick={() => setWalletModalOpen(true)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                walletState.connected
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Wallet className="h-3.5 w-3.5 text-emerald-400" />
              <span className="mono">
                {walletState.connected ? shortHash(walletState.address, 4, 4) : 'Connect Wallet'}
              </span>
            </button>
          </div>
        </header>

        {/* Page Body */}
        <div className="p-8 flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/assets" replace />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/decrypt" element={<Decrypt />} />
            <Route path="/trace" element={<Trace />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/robustness" element={<Robustness />} />
            <Route path="*" element={<p className="text-slate-500">Screen not found.</p>} />
          </Routes>
        </div>
      </main>

      {/* Modals */}
      <DemoScriptModal isOpen={demoScriptOpen} onClose={() => setDemoScriptOpen(false)} />
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        walletState={walletState}
        setWalletState={setWalletState}
        signingMode={signingMode}
        setSigningMode={setSigningMode}
      />
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

function HealthBadge({ health, demoMode }) {
  const isUp = health?.ok || demoMode;

  return (
    <div className="mono border-t border-slate-800/80 pt-4 text-[11px] text-slate-400 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${isUp ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span className="font-semibold text-slate-300">
            {demoMode ? 'engine active' : isUp ? 'api online' : 'api offline'}
          </span>
        </div>
        <span className="text-[10px] text-cyan-400">Sepolia</span>
      </div>

      <div className="text-[10px] text-slate-500">
        <div>db: {demoMode ? 'in-memory (synced)' : health?.db || 'connected'}</div>
        <div>chain: {health?.chainMode || 'sepolia testnet'}</div>
      </div>
    </div>
  );
}
