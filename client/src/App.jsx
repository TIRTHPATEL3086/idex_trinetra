import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

import { getHealth } from './lib/api.js';
import { useAuth, ROLE_UI, initialsOf } from './lib/auth.jsx';
import { RequireAuth, RequireCap } from './components/RequireAuth.jsx';
import Logo from './components/Logo.jsx';
import Preloader from './components/Preloader.jsx';
import { CloseIcon, ShieldIcon as ShieldGlyph, SignOutIcon } from './components/icons.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
// The signed-in screens load only when opened, so a visitor to the landing or
// sign-in page does not download the charts, the wallet code or every screen.
const Assets = lazy(() => import('./pages/Assets.jsx'));
const Decrypt = lazy(() => import('./pages/Decrypt.jsx'));
const Trace = lazy(() => import('./pages/Trace.jsx'));
const Timeline = lazy(() => import('./pages/Timeline.jsx'));
const Robustness = lazy(() => import('./pages/Robustness.jsx'));
const History = lazy(() => import('./pages/History.jsx'));
const PqcEnroll = lazy(() => import('./pages/PqcEnroll.jsx'));
const Inspect = lazy(() => import('./pages/Inspect.jsx'));
const Officers = lazy(() => import('./pages/Officers.jsx'));

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
  { to: '/officers', label: 'Officers', icon: UsersIcon, cap: 'users:write' },
];

export default function App() {
  // The intro plays on every fresh load of the landing page — a first visit,
  // a refresh, a return — but not on in-app navigation back to it.
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
            <NetworkStatus network={health?.network} />
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
              <Suspense fallback={<ScreenLoading />}>
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
                    path="/officers"
                    element={
                      <RequireCap capability="users:write">
                        <Officers />
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
              </Suspense>
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

/**
 * Deployment status: "air-gapped" only when the server reports no dependency
 * beyond this machine or its private network — the claim is checked, not
 * decorative.
 */
function NetworkStatus({ network }) {
  if (!network) return null;
  const off = network.airGapped;
  return (
    <span
      title={
        off
          ? 'No dependency outside this machine or its private network'
          : 'This deployment depends on internet services'
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
        off
          ? 'border-attributed-bright bg-attributed-tint text-attributed-deep'
          : 'border-probable-bright bg-probable-tint text-probable-deep'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${off ? 'bg-attributed' : 'bg-probable'}`} />
      <span className="hidden md:inline">{off ? 'Air-gapped · offline' : 'Online'}</span>
      <span className="md:hidden">{off ? 'Offline' : 'Online'}</span>
    </span>
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
  const meta = ROLE_UI[user?.role] ?? {};

  if (!user) return null;

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
        </div>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-bold leading-tight text-ink group-hover:text-black">
            {user.name}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-muted">
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
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-line/90 bg-white/95 p-5 sm:p-7 shadow-2xl backdrop-blur-xl transition-all duration-200 animate-in zoom-in-95 space-y-5"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line/70 pb-4">
              <div className="flex items-center gap-2">
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
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-extrabold text-ink truncate">{user.name}</h4>
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
/** Shown in the content area for the moment a screen's code is loading. */
function ScreenLoading() {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-label="Loading">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
    </div>
  );
}

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
function UsersIcon(p) {
  return (
    <NavIcon {...p}>
      <circle cx="9" cy="8" r="3.5" {...S} />
      <path
        d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"
        {...S}
      />
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
