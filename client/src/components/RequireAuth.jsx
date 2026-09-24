import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, ROLE_UI } from '../lib/auth.jsx';

/**
 * Route guards.
 *
 * `RequireAuth` holds anything private until the boot-time session check has
 * answered — without that wait, a page refresh would bounce a signed-in user to
 * /login for the half-second the cookie takes to verify.
 *
 * `RequireCap` is the second gate: signed in, but does this role hold the
 * capability this screen needs? It explains the refusal rather than pretending
 * the screen does not exist, because "you are not allowed" and "this is broken"
 * feel identical to someone who is just told no.
 */
export function RequireAuth({ children }) {
  const { user, state } = useAuth();
  const location = useLocation();

  if (state === 'checking') return <BootSplash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function RequireCap({ capability, children }) {
  const { user, can } = useAuth();
  if (!can(capability)) return <NotPermitted role={user?.role} capability={capability} />;
  return children;
}

function BootSplash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-shell px-6">
      <div className="mono animate-pulse text-sm text-accent/70">Restoring session…</div>
    </div>
  );
}

/** Shown inside the app shell, so the sidebar and sign-out stay reachable. */
function NotPermitted({ role, capability }) {
  const meta = ROLE_UI[role];
  return (
    <section className="grid place-items-center px-2 py-10 sm:py-16">
      <div className="card w-full max-w-lg p-6 text-center sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-line">
          <LockIcon />
        </div>

        <h2 className="mt-4 font-display text-xl font-extrabold text-ink">
          Not available to your role
        </h2>

        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          You are signed in as {meta?.label ?? role}. {meta?.blurb}
        </p>

        <p className="mono mt-4 inline-block rounded-full bg-line/60 px-3 py-1.5 text-[11px] text-ink-muted">
          requires {capability}
        </p>

        <p className="mt-5 text-xs leading-relaxed text-ink-faint">
          This is a separation of duties, not a missing feature — an account that can do both halves
          of this system could manufacture the evidence it later finds.
        </p>
      </div>
    </section>
  );
}

function LockIcon() {
  const s = {
    stroke: '#737373',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" {...s} />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...s} />
      <circle cx="12" cy="15.2" r="1.15" fill="#737373" />
    </svg>
  );
}
