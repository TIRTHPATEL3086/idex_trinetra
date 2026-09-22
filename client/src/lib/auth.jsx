import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, onSessionLost } from './api.js';

/**
 * The session, held once at the top of the tree.
 *
 * The capability list comes from the server — the same table the API enforces —
 * so the UI and the API can never drift into disagreeing about what a role may
 * do. Hiding a button the server would refuse anyway is a courtesy; the refusal
 * is the actual control, and it lives in `server/lib/permissions.js`.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'checking' until the boot-time /me has answered — the router must not
  // bounce someone to /login just because the session check is in flight.
  const [state, setState] = useState('checking');

  useEffect(() => {
    let alive = true;
    getMe()
      .then((r) => {
        if (!alive) return;
        setUser(r.user);
        setState('ready');
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
        setState('ready');
      });
    return () => {
      alive = false;
    };
  }, []);

  // A 401 from any route means the cookie expired mid-session. Drop the user
  // so the guards fall through to /login instead of leaving the shell up with
  // every panel quietly failing.
  useEffect(() => onSessionLost(() => setUser(null)), []);

  const signIn = useCallback(async (email, password) => {
    const r = await apiLogin(email, password);
    setUser(r.user);
    return r.user;
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout().catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      state,
      signIn,
      signOut,
      /** @param {string} capability e.g. 'trace:run' */
      can: (capability) => !!user?.capabilities?.includes(capability),
    }),
    [user, state, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Presentation for each role — the badge in the header, and the account cards
 * on the login screen. Kept beside the session rather than in the page so the
 * badge and the login card can never describe a role differently.
 */
export const ROLE_UI = {
  ADMIN: {
    label: 'Registry Administrator',
    short: 'Admin',
    blurb: 'Full custody — uploads, releases, investigations and the audit trail.',
    badge: 'bg-noir text-accent',
    tint: 'bg-noir',
    demo: { email: 'admin@example.gov', password: 'admin123' },
  },
  OFFICER: {
    label: 'Clearance Holder',
    short: 'Officer',
    blurb: 'Releases a watermarked copy to themselves. Cannot investigate.',
    badge: 'bg-accent text-noir',
    tint: 'bg-accent',
    demo: { email: 'u017@example.gov', password: 'officer123' },
  },
  // INVESTIGATOR and AUDITOR demo roles removed per project requirements
};

export const ROLE_ORDER = ['ADMIN', 'OFFICER'];

/**
 * Demo accounts for one-click evaluation.
 *
 * Only the roles this deployment actually ships: INVESTIGATOR and AUDITOR were
 * removed from ROLE_UI, so listing them here would hand the login page a role
 * it cannot render.
 */
export const DEMO_ACCOUNTS = [
  {
    role: 'ADMIN',
    short: 'Admin',
    badge: 'bg-noir text-accent',
    title: 'Registry Administrator',
    name: 'Admin Desk',
    dept: 'HQ',
    email: 'admin@example.gov',
    password: 'admin123',
    desc: 'Full custody & management',
  },
  {
    role: 'OFFICER',
    short: 'Officer 1',
    badge: 'bg-accent text-noir',
    title: 'Clearance Holder',
    name: 'Officer U-017',
    dept: 'Ops Wing',
    email: 'u017@example.gov',
    password: 'officer123',
    desc: 'Operations Wing clearance',
  },
  {
    role: 'OFFICER',
    short: 'Officer 2',
    badge: 'bg-accent text-noir',
    title: 'Clearance Holder',
    name: 'Officer U-023',
    dept: 'Signals',
    email: 'u023@example.gov',
    password: 'officer123',
    desc: 'Signals Intelligence clearance',
  },
  {
    role: 'OFFICER',
    short: 'Officer 3',
    badge: 'bg-accent text-noir',
    title: 'Clearance Holder',
    name: 'Officer U-041',
    dept: 'Logistics',
    email: 'u041@example.gov',
    password: 'officer123',
    desc: 'Defense Logistics clearance',
  },
];

/** Initials for the avatar — "Officer U-017" -> "OU". */
export function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
