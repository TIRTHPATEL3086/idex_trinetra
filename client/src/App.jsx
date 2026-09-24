import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';

import { getHealth, shortHash } from './lib/api.js';
import { useAuth, ROLE_UI, initialsOf } from './lib/auth.jsx';
import { RequireAuth, RequireCap } from './components/RequireAuth.jsx';
import Logo from './components/Logo.jsx';
import Preloader from './components/Preloader.jsx';
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ShieldIcon as ShieldGlyph,
  SignOutIcon,
} from './components/icons.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Assets from './pages/Assets.jsx';
import Decrypt from './pages/Decrypt.jsx';
import Trace from './pages/Trace.jsx';
import Timeline from './pages/Timeline.jsx';
import Robustness from './pages/Robustness.jsx';
import History from './pages/History.jsx';
import PqcEnroll from './pages/PqcEnroll.jsx';
import Inspect from './pages/Inspect.jsx';

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
  { to: '/inspect', label: 'Watermark', icon: FingerprintIcon, cap: 'decrypt:any' },
  { to: '/timeline', label: 'Timeline', icon: ClockIcon, cap: 'audit:own' },
  { to: '/history', label: 'History', icon: HistoryIcon, cap: 'audit:read' },
  { to: '/enroll', label: 'PQC Enroll', icon: ShieldIcon, cap: 'assets:upload' },
  { to: '/robustness', label: 'Robustness', icon: ChartIcon, cap: 'metrics:read' },
];

export default function App() {
  // The intro plays on a fresh load of the landing page, not on in-app
  // navigation back to it.
  const [booting, setBooting] = useState(() => {
    const show = window.location.pathname === '/';
    // Mark the page as covered before anything renders, so no entrance on the
    // landing page can start ahead of the loader's own effect.
    if (show) document.documentElement.classList.add('is-preloading');
    return show;
  });
  const finishBoot = useCallback(() => setBooting(false), []);

  return (
    <>
      {booting && <Preloader onDone={finishBoot} />}
      <Routes>
        <Route path="/" element={<LandingGate />} />
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
    </>
  );
}

/**
 * `/` is public. Someone already signed in has no use for the pitch, so they go
 * straight to whichever screen their role lands on — but only once the
 * boot-time session check has answered, or a returning user would see the
 * landing page flash before being bounced.
 */
function LandingGate() {
  const { user, state } = useAuth();
  if (state === 'checking') return null;
  if (user) return <Navigate to={user.landing || '/assets'} replace />;
  return <Landing />;
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
    <div className="overflow-hidden bg-shell p-1.5 [height:100dvh] sm:p-3 xl:p-4">
      {/* The reference's radius: 1.5rem on mobile, 3.125rem from lg up. */}
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-panel border border-white bg-white shadow-app lg:rounded-[3.125rem]">
        {/* ---- top bar (fixed) ---- */}
        <header className="flex shrink-0 items-center gap-2.5 border-b border-line px-3.5 py-3 sm:px-6">
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

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5 shrink-0">
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

          <Sidebar open={navOpen} can={can} />

          <main className="scroll-slim min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-5 sm:px-6 sm:py-6 xl:px-8">
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
                  path="/inspect"
                  element={
                    <RequireCap capability="decrypt:any">
                      <Inspect />
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

function Sidebar({ open, can }) {
  // Capability alone decides what appears here. A hard-coded role exception
  // would put the menu and the router out of step with the server, which is
  // the one thing this list exists to prevent.
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
                  ? 'bg-accent text-noir shadow-[0_8px_22px_-10px_rgba(255,255,255,0.75)]'
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

      {can('trace:run') && (
        <div className="mt-auto pt-6">
          <NavLink to="/trace" className="btn-accent w-full">
            <SearchIcon />
            Trace a leak
          </NavLink>
        </div>
      )}
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

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      {/* Top Header Pill Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account details and session"
        className="group flex items-center gap-2.5 rounded-full border border-line/80 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-accent-deep hover:shadow-md sm:pr-3 cursor-pointer"
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

      {/* ── Centered Modal Popup with Partial Background Blur ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-noir/50 backdrop-blur-md transition-all duration-200 animate-in fade-in"
          onClick={handleClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-line/90 bg-white/95 p-6 sm:p-7 shadow-2xl backdrop-blur-xl transition-all duration-200 animate-in zoom-in-95 space-y-5"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line/70 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-attributed animate-pulse" />
                <h3 className="text-sm font-extrabold tracking-wide uppercase text-ink-muted">
                  Account & Clearance Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-noir/5 hover:text-ink transition font-bold"
                aria-label="Close popup"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            {/* User Profile Overview */}
            <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-surface to-muted p-4 border border-line/80 shadow-xs">
              <div className="relative shrink-0">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-noir to-[#1b232e] text-base font-extrabold text-accent shadow-md ring-2 ring-accent/40">
                  {initialsOf(user.name)}
                </span>
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-attributed" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-extrabold text-ink truncate">{user.name}</h4>
                  <span className="rounded-full bg-attributed-tint px-2 py-0.5 text-[10px] font-bold text-attributed-deep">
                    ACTIVE
                  </span>
                </div>
                <div className="text-xs text-ink-muted truncate mt-0.5">{user.email}</div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="font-bold text-ink">Dept: {user.dept}</span>
                  <span className="text-ink-faint">·</span>
                  <span className={`pill !text-[10px] !py-0.5 ${meta.badge ?? 'bg-line text-ink'}`}>
                    <ShieldGlyph size={12} />
                    {meta.short || user.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Clearance & Role Capability Blurb */}
            {meta.blurb && (
              <p className="rounded-2xl bg-muted p-3 text-xs leading-relaxed text-ink-muted border border-line/60">
                {meta.blurb}
              </p>
            )}

            {/* On-Chain Sepolia Identity Card */}
            <div className="rounded-2xl border border-line/70 bg-gradient-to-br from-surface to-muted p-4 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-attributed" />
                  On-Chain Cryptographic Identity
                </span>
                <span className="text-[10px] font-bold text-attributed-deep bg-attributed-tint/70 px-2 py-0.5 rounded-full">
                  Sepolia Zero-PII
                </span>
              </div>
              <p className="text-[11px] text-ink-muted">
                Keccak-256 handle verified across Ethereum smart contract logs:
              </p>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-line/80 bg-white px-3 py-2 shadow-inner">
                <span className="mono text-xs font-bold text-ink truncate">
                  {user.userRef ? shortHash(user.userRef, 10, 8) : 'Not enrolled'}
                </span>
                <button
                  type="button"
                  onClick={copyHandle}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold text-ink-muted transition hover:bg-accent hover:text-noir"
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

            {/* Signing out is not destructive — you sign back in. A red
                two-step confirmation made an ordinary action look alarming,
                so this is one plain button. */}
            <div className="border-t border-line/80 pt-3">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  signOut();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3 text-sm font-semibold text-ink transition hover:bg-muted"
              >
                <SignOutIcon size={15} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
  const [switchError, setSwitchError] = useState(null);

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
        } catch (err) {
          if (err?.code === 4902) {
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

  /**
   * Ask the wallet to change network.
   *
   * Three things this has to get right. It must not ask to switch to the
   * chain the wallet is already on — that is a no-op the extension can choke
   * on. It must only offer to *add* a chain the wallet genuinely does not
   * know: Sepolia ships with MetaMask, and adding a built-in network is
   * refused. And it must not swallow the result, or a refusal looks
   * identical to success.
   */
  async function switchToChain(targetHex, name, rpc) {
    const eth = window.ethereum;
    if (!eth) return;
    setSwitchError(null);

    if (chainId && chainId.toLowerCase() === targetHex.toLowerCase()) return;

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetHex }],
      });
    } catch (err) {
      // 4902 means the wallet has never heard of this chain, which for us
      // only ever happens with a local dev node.
      if (err?.code === 4902 && rpc) {
        try {
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
        } catch (addErr) {
          if (addErr?.code !== 4001) {
            setSwitchError(addErr?.message || `Could not add ${name}.`);
          }
        }
        return;
      }
      if (err?.code === 4001) return; // the user declined; not an error
      setSwitchError(err?.message || `Could not switch to ${name}.`);
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
                  {switchError && (
                    <p className="rounded-xl bg-danger-tint px-2.5 py-2 text-[11px] leading-relaxed text-danger-deep">
                      {switchError}
                    </p>
                  )}
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
                      onClick={() => switchToChain('0xaa36a7', 'Sepolia', null)}
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

/* ----------------------------------------------------------------- icons -- */
const S = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** Icons inherit their colour from the control, so one rule covers the light
    top bar, the dark rail, and the coral active pill. */
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
function FingerprintIcon(p) {
  return (
    <NavIcon {...p}>
      <path d="M5 12a7 7 0 0 1 14 0" {...S} />
      <path d="M8 12.4a4 4 0 0 1 8 0c0 2.2-.3 4.3-.9 6.3" {...S} />
      <path d="M11 12.6a1 1 0 0 1 2 0c0 3-.5 5.9-1.4 8.6" {...S} />
      <path d="M5.4 16.5c.4 1.4.5 2.6.4 3.9" {...S} />
    </NavIcon>
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
