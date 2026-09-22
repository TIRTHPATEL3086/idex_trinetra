import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { getHealth, shortHash } from './lib/api.js';
import { useAuth, ROLE_UI, initialsOf } from './lib/auth.jsx';
import { RequireAuth, RequireCap } from './components/RequireAuth.jsx';
import Logo from './components/Logo.jsx';
import {
  CheckIcon,
  CopyIcon,
  ShieldIcon as ShieldGlyph,
  SignOutIcon,
} from './components/icons.jsx';
import Login from './pages/Login.jsx';
import Assets from './pages/Assets.jsx';
import Decrypt from './pages/Decrypt.jsx';
import Trace from './pages/Trace.jsx';
import Timeline from './pages/Timeline.jsx';
import Robustness from './pages/Robustness.jsx';
import History from './pages/History.jsx';
import PqcEnroll from './pages/PqcEnroll.jsx';

/**
 * Application shell — a white, large-radius app panel on a warm cream canvas,
 * with a coral accent and a dark navigation rail, following the nomu reference.
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
  { to: '/history', label: 'History', icon: HistoryIcon, cap: 'audit:read' },
  { to: '/enroll', label: 'PQC Enroll', icon: ShieldIcon, cap: 'assets:upload' },
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
    <div className="overflow-hidden bg-canvas p-2 [height:100dvh] sm:p-4 lg:p-6">
      {/* The app panel. The reference's radius is 1.5rem on mobile and 3.125rem
          from the large breakpoint up — we follow it exactly. */}
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-panel border border-line bg-white shadow-app lg:rounded-[3.125rem]">
        {/* ---- top bar (fixed) ---- */}
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3.5 sm:px-7 lg:px-8">
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
            {user?.role !== 'OFFICER' && (
              <>
                <HealthChip health={health} />
                <NotificationsBell health={health} />
              </>
            )}
            <WalletButton health={health} />
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
              className="fixed inset-0 z-30 bg-noir/40 backdrop-blur-sm lg:hidden"
            />
          )}

          <Sidebar health={health} open={navOpen} can={can} user={user} />

          <main className="scroll-slim min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-9 lg:py-10">
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
                <Route
                  path="/history"
                  element={
                    <RequireCap capability="audit:read">
                      <History />
                    </RequireCap>
                  }
                />
                <Route
                  path="/enroll"
                  element={
                    <RequireCap capability="assets:upload">
                      <PqcEnroll />
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

/**
 * Navigation rail — an inset, large-radius dark block, the way the reference
 * drops a dark section into its cream page. The active item is a coral pill;
 * coral carries dark ink rather than white, because white on #ff7448 is only
 * a 2.8:1 contrast and these labels are 14px.
 */
function Sidebar({ health, open, can, user }) {
  const items = NAV.filter((n) => can(n.cap));
  return (
    <aside
      className={`scroll-slim scroll-dark fixed inset-y-0 left-0 z-40 flex w-64 max-w-[82vw] flex-col overflow-y-auto bg-noir-deep p-4 text-white transition-transform duration-200 lg:static lg:z-auto lg:my-3 lg:ml-3 lg:w-64 lg:max-w-none lg:translate-x-0 lg:rounded-3xl ${
        open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}
    >
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <Logo size="sm" onDark />
      </div>

      <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
        Menu
      </div>
      <nav className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-accent text-noir shadow-[0_8px_20px_-10px_rgba(255,116,72,0.95)]'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
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
          <NavLink to="/trace" className="btn-accent w-full">
            <SearchIcon />
            Trace a leak
          </NavLink>
        )}
        {user?.role !== 'OFFICER' && (
          <>
            <RoleCard user={user} />
            <HealthBadge health={health} />
          </>
        )}
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

/**
 * The same status is shown twice — as a chip on the white top bar and inside
 * the badge on the dark rail — so each state carries both cuts. `toneDark` is
 * not decoration: #007956 on navy is unreadable.
 */
function healthTone(health) {
  if (!health)
    return { dot: 'bg-ink-faint', label: '…', tone: 'text-ink-faint', toneDark: 'text-white/50' };
  if (!health.ok)
    return {
      dot: 'bg-inconclusive',
      label: 'API down',
      tone: 'text-inconclusive',
      toneDark: 'text-inconclusive-bright',
    };
  if (health.warnings?.length)
    return {
      dot: 'bg-probable',
      label: 'Degraded',
      tone: 'text-probable',
      toneDark: 'text-probable-bright',
    };
  return {
    dot: 'bg-attributed',
    label: 'All systems go',
    tone: 'text-attributed-deep',
    toneDark: 'text-attributed-bright',
  };
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
  const { dot, label, toneDark } = healthTone(health);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${dot} animate-pulse`} />
          <span className={toneDark}>{label}</span>
        </div>
        <span className="mono rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white/50">
          NODE TELEMETRY
        </span>
      </div>
      {health.ok && (
        <dl className="mono mt-2.5 space-y-1.5 divide-y divide-white/10 text-[11px] text-white/60">
          <div className="pt-1">
            <Row k="DATABASE" v={health.db?.toUpperCase() || 'UP'} good={health.db === 'up'} />
          </div>
          <div className="pt-1">
            <Row
              k="LEDGER"
              v={health.chainMode === 'sepolia' ? 'SEPOLIA (ETH)' : health.chainMode?.toUpperCase()}
              good={health.chain?.connected}
            />
          </div>
          <div className="pt-1 flex items-center justify-between">
            <dt className="text-white/45">PQC ALGO</dt>
            <dd className="font-semibold text-attributed-bright">ML-KEM / DSA</dd>
          </div>
          {health.warnings?.length > 0 && (
            <div className="pt-1 text-[10px] font-medium text-probable-bright">
              {health.warnings.length} warning(s) flagged
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function Row({ k, v, good }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-white/45">{k}</dt>
      <dd className={good ? 'font-semibold text-attributed-bright' : 'font-semibold text-white/50'}>
        {v}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------- account --- */

/**
 * The signed-in identity: avatar, role, on-chain privacy passport, sign out.
 */
function AccountMenu({ user }) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = ROLE_UI[user?.role] ?? {};

  if (!user) return null;

  function copyHandle() {
    if (!user.userRef) return;
    navigator.clipboard.writeText(user.userRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-expanded={open}
        className="group flex items-center gap-2.5 rounded-full border border-line/80 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-accent-deep hover:shadow-md sm:pr-3"
      >
        <div className="relative">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-noir to-[#1b232e] text-xs font-extrabold text-accent ring-2 ring-accent/30 transition group-hover:ring-accent">
            {initialsOf(user.name)}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-attributed" />
        </div>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-bold leading-tight text-ink group-hover:text-black">
            {user.name}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-deep" />
            {meta.short || user.role}
          </span>
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
          <div className="absolute right-0 z-50 mt-2.5 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-line/80 bg-white/95 p-4 shadow-2xl backdrop-blur-xl transition-all animate-in fade-in zoom-in-95">
            {/* Header / Avatar */}
            <div className="flex items-center gap-3.5 border-b border-line/60 pb-3.5">
              <div className="relative">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-noir to-[#1b232e] text-sm font-extrabold text-accent shadow-md ring-2 ring-accent/20">
                  {initialsOf(user.name)}
                </span>
                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-attributed" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-ink">{user.name}</span>
                  <span className="rounded bg-accent/20 px-1.5 py-0.2 text-[10px] font-bold text-accent-deep">
                    ACTIVE
                  </span>
                </div>
                <div className="truncate text-xs text-ink-muted">{user.email}</div>
              </div>
            </div>

            {/* Role & duty, and the hashed handle — the only identity that
                reaches the chain, kept deliberately apart from the name above. */}
            {user?.role !== 'OFFICER' && (
              <div className="mt-3.5 space-y-2.5 border-t border-line pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    Security Clearance
                  </span>
                  <span className={`pill ${meta.badge ?? 'bg-line text-ink'}`}>
                    <ShieldGlyph size={12} />
                    {meta.short || user.role}
                  </span>
                </div>
                <p className="rounded-xl bg-muted p-2.5 text-[11px] leading-relaxed text-ink-muted">
                  {meta.blurb}
                </p>

                {/* On-Chain Privacy Identity (The Cryptographic Highlight) */}
                <div className="rounded-2xl border border-line/70 bg-gradient-to-br from-[#faf8f5] to-muted p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                      <span className="h-1.5 w-1.5 rounded-full bg-attributed animate-pulse" />
                      On-Chain Identity (Sepolia)
                    </span>
                    <span className="text-[9px] font-semibold text-attributed-deep bg-attributed-tint px-1.5 py-0.5 rounded">
                      Zero-PII
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-ink-muted">
                    Cryptographic Keccak-256 handle committed to Ethereum ledger:
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-line/80 bg-white px-2.5 py-1.5 shadow-inner">
                    <span className="mono text-xs font-semibold text-ink">
                      {shortHash(user.userRef, 8, 6)}
                    </span>
                    <button
                      type="button"
                      onClick={copyHandle}
                      className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-bold text-ink-muted transition hover:bg-accent hover:text-noir"
                      title="Copy full 32-byte on-chain userRef"
                    >
                      {copied ? (
                        <span className="flex items-center gap-1 font-bold text-attributed-deep">
                          <CheckIcon size={12} /> Copied
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CopyIcon size={12} /> Copy
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sign Out Action */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-muted/80 py-2.5 text-xs font-bold text-ink transition hover:border-danger-bright hover:bg-danger-tint hover:text-danger-deep"
            >
              <span>Sign out</span>
              <SignOutIcon size={14} />
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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 text-white">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-accent/90">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Enclave Session
        </span>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
          {meta.short || user.role}
        </span>
      </div>
      <div className="mt-2 truncate text-xs font-bold text-white tracking-wide">{user.name}</div>
      <div className="flex items-center justify-between text-[11px] text-white/60 mt-0.5">
        <span className="truncate">{user.dept || 'HQ Operations'}</span>
        <span className="mono text-[10px] text-white/40 font-semibold">U-00{user.id}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- wallet ----- */

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

/** Real MetaMask connect via window.ethereum. Degrades cleanly with no wallet. */
function WalletButton({ health }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;

    eth
      .request({ method: 'eth_accounts' })
      .then((a) => a?.[0] && setAccount(a[0]))
      .catch(() => {});

    eth
      .request({ method: 'eth_chainId' })
      .then((cid) => cid && setChainId(cid))
      .catch(() => {});

    const onAccountsChange = (a) => setAccount(a?.[0] ?? null);
    const onChainChange = (cid) => setChainId(cid);

    eth.on?.('accountsChanged', onAccountsChange);
    eth.on?.('chainChanged', onChainChange);
    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChange);
      eth.removeListener?.('chainChanged', onChainChange);
    };
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

      const cid = await eth.request({ method: 'eth_chainId' });
      setChainId(cid);

      // Prompt network switch for local Hardhat node if running in local mode
      if (health?.chainMode === 'local' || !health?.chainMode) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x7a69' }], // 31337 in hex
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x7a69',
                  chainName: 'Hardhat Localhost',
                  rpcUrls: ['http://127.0.0.1:8545'],
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                },
              ],
            });
          }
        }
      }
    } catch {
      /* user rejected — leave disconnected */
    } finally {
      setBusy(false);
    }
  }

  async function switchToChain(targetHex, name, rpc) {
    const eth = window.ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetHex }],
      });
    } catch (err) {
      if (err.code === 4902 && rpc) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: targetHex,
              chainName: name,
              rpcUrls: [rpc],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            },
          ],
        });
      }
    }
  }

  const isLocalChain = chainId === '0x7a69' || chainId === '0x7A69';
  const isSepolia = chainId === '0xaa36a7' || chainId === '0xAA36A7';

  const chainLabel = isLocalChain
    ? 'Hardhat (31337)'
    : isSepolia
      ? 'Sepolia (11155111)'
      : chainId
        ? `Chain ${parseInt(chainId, 16) || chainId}`
        : 'Chain';

  if (account) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          title="MetaMask wallet details & chain settings"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink-faint transition"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isLocalChain || isSepolia ? 'bg-attributed animate-pulse' : 'bg-probable'
            }`}
          />
          <span className="mono">{short(account)}</span>
          <span className="hidden md:inline-block text-[10px] text-ink-muted bg-noir/5 px-2 py-0.5 rounded-full font-medium">
            {chainLabel}
          </span>
        </button>

        {panelOpen && (
          <>
            <button
              type="button"
              aria-label="Close wallet menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setPanelOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-attributed" />
                  <span className="text-xs font-bold text-ink">MetaMask Connected</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccount(null);
                    setPanelOpen(false);
                  }}
                  className="text-[11px] font-semibold text-ink-muted hover:text-ink"
                >
                  Disconnect
                </button>
              </div>

              <div className="space-y-3 pt-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                    Wallet Account
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1 rounded-xl bg-noir/5 p-2 font-mono text-[11px] text-ink">
                    <span className="truncate">{account}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(account);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-white border border-line font-sans font-semibold hover:bg-noir/10"
                    >
                      {copied ? <CheckIcon size={12} /> : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Active Network</span>
                  <span className="font-semibold text-ink">{chainLabel}</span>
                </div>

                {health?.chain && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Chain Mode</span>
                      <span className="font-mono text-[11px] font-semibold uppercase text-ink">
                        {health.chain.mode}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Registry Contract</span>
                      <span className="font-mono text-[11px] text-ink" title={health.chain.address}>
                        {short(health.chain.address)}
                      </span>
                    </div>

                    {health.chain.blockNumber && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-muted">Sync Block</span>
                        <span className="font-mono text-[11px] text-ink">
                          #{health.chain.blockNumber}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="pt-2 border-t border-line space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                    Switch Network
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        switchToChain('0x7a69', 'Hardhat Localhost', 'http://127.0.0.1:8545')
                      }
                      className={`flex-1 rounded-xl py-1.5 text-xs font-semibold border transition ${
                        isLocalChain
                          ? 'border-accent bg-accent/10 text-ink'
                          : 'border-line bg-white hover:bg-noir/5 text-ink'
                      }`}
                    >
                      Localhost (31337)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        switchToChain('0xaa36a7', 'Sepolia Testnet', 'https://rpc.sepolia.org')
                      }
                      className={`flex-1 rounded-xl py-1.5 text-xs font-semibold border transition ${
                        isSepolia
                          ? 'border-accent bg-accent/10 text-ink'
                          : 'border-line bg-white hover:bg-noir/5 text-ink'
                      }`}
                    >
                      Sepolia (11155111)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
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

/** Icons inherit their colour from the nav item, so one rule covers the
    light top bar, the dark rail, and the coral active pill. */
function NavIcon({ children }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="text-current"
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
function HistoryIcon(p) {
  return (
    <NavIcon {...p}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" {...S} />
      <path d="M3 3v5h5M12 7v5l4 2" {...S} />
    </NavIcon>
  );
}
function ShieldIcon(p) {
  return (
    <NavIcon {...p}>
      <path d="M12 3 4 7v5c0 4.4 3.3 8.5 8 9.5 4.7-1 8-5.1 8-9.5V7l-8-4Z" {...S} />
      <path d="m9 12 2 2 4-4" {...S} />
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
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 7V6a2 2 0 0 1 2-2h11M16 13h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
