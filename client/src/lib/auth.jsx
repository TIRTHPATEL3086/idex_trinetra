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

/**
 * Marks this tab as one that has already been open. sessionStorage lives as
 * long as the tab: a refresh keeps it, closing the tab drops it. So a load
 * without it is a new tab or a reopened site, and that starts signed out.
 */
const TAB_SESSION = 'idex:tab-open';

/** True on the first load in this tab; marks the tab either way. */
function markTab() {
  try {
    const fresh = sessionStorage.getItem(TAB_SESSION) !== '1';
    sessionStorage.setItem(TAB_SESSION, '1');
    return fresh;
  } catch {
    return false; // storage blocked: fall back to the cookie alone
  }
}

/** Decided once per page load, however often the provider mounts. */
const FRESH_TAB = markTab();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'checking' until the boot-time /me has answered — the router must not
  // bounce someone to /login just because the session check is in flight.
  const [state, setState] = useState('checking');

  useEffect(() => {
    let alive = true;
    // Closing the tab ends the session: a new tab, or the site reopened,
    // signs out on the server before anything is shown. A refresh keeps it.
    const session = FRESH_TAB
      ? apiLogout()
          .catch(() => {})
          .then(() => {
            throw new Error('A new tab starts signed out.');
          })
      : getMe();
    session
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

  const signIn = useCallback(async (email, password, extra = {}) => {
    const r = await apiLogin(email, password, extra);
    if (r.user) {
      setUser(r.user);
    }
    return r;
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
    tint: 'bg-white',
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
  INVESTIGATOR: {
    label: 'Forensic Analyst',
    short: 'Investigator',
    blurb: 'Traces leaked files. Cannot decrypt, so cannot manufacture evidence.',
    badge: 'bg-attributed-tint text-attributed-deep',
    tint: 'bg-attributed-bright',
    demo: { email: 'a004@example.gov', password: 'analyst123' },
  },
  // Indian Navy Defense Roles
  CRYPTO_CUSTODIAN: {
    label: 'Cryptographic Custodian',
    short: 'Custodian',
    blurb:
      'WESEE Signals HQ: Originates dispatches, multi-recipient ML-KEM-768 broadcast encryption.',
    badge: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
    tint: 'bg-emerald-500',
    demo: { email: 'custodian@navy.gov.in', password: 'custodian123' },
  },
  TACTICAL_OFFICER: {
    label: 'Tactical Recipient Officer',
    short: 'CO Vikrant',
    blurb:
      'Naval Operations: Decrypts authorized dispatches with personal ML-KEM private key, signs with ML-DSA.',
    badge: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30',
    tint: 'bg-cyan-500',
    demo: { email: 'co.vikrant@navy.gov.in', password: 'officer123' },
  },
  FORENSIC_ANALYST: {
    label: 'Naval Cyber Forensic Analyst',
    short: 'Provost',
    blurb:
      'Naval Cyber Cell: Traces leaked media, DWT extraction, issues Sec 65B/63 BSA Court Dossier.',
    badge: 'bg-amber-950/80 text-amber-300 border border-amber-500/30',
    tint: 'bg-amber-500',
    demo: { email: 'provost@navy.gov.in', password: 'analyst123' },
  },
  NAVAL_AUDITOR: {
    label: 'Naval Audit & Oversight Authority',
    short: 'JAG Auditor',
    blurb: 'Judge Advocate General: Zero-knowledge verification of immutable DLT ledger.',
    badge: 'bg-purple-950/80 text-purple-300 border border-purple-500/30',
    tint: 'bg-purple-500',
    demo: { email: 'jag@navy.gov.in', password: 'audit123' },
  },
};

export const ROLE_ORDER = ['ADMIN', 'OFFICER', 'INVESTIGATOR'];

/**
 * Demo accounts for one-click evaluation.
 *
 * Only the roles this deployment actually ships, so the picker can never hand
 * the login page a role that ROLE_UI cannot render.
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
  {
    role: 'INVESTIGATOR',
    short: 'Investigator',
    badge: 'bg-attributed-tint text-attributed-deep',
    title: 'Forensic Analyst',
    name: 'Analyst A-004',
    dept: 'Intel Cell',
    email: 'a004@example.gov',
    password: 'analyst123',
    desc: 'Leak attribution, no decrypt rights',
  },
];

/** Initials for the avatar — "Officer U-017" -> "OU". */
export function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
