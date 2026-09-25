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
/**
 * Presentation for each Indian Navy defense role — badges, headers, and login cards.
 */
export const ROLE_UI = {
  CRYPTO_CUSTODIAN: {
    label: 'Cryptographic Custodian',
    short: 'Signals Custodian',
    rank: 'Commander (WESEE HQ)',
    blurb: 'WESEE Signals HQ: Originates dispatches, multi-recipient ML-KEM-768 broadcast encryption, key roster.',
    badge: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
    tint: 'bg-emerald-500',
    demo: { email: 'custodian@navy.gov.in', password: 'custodian123' },
  },
  TACTICAL_OFFICER: {
    label: 'Tactical Recipient Officer',
    short: 'CO / Tactical Officer',
    rank: 'Captain / Commanding Officer',
    blurb: 'Naval Operations: Decrypts authorized dispatches with personal ML-KEM private key, signs release receipt with ML-DSA.',
    badge: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30',
    tint: 'bg-cyan-500',
    demo: { email: 'co.vikrant@navy.gov.in', password: 'officer123' },
  },
  FORENSIC_ANALYST: {
    label: 'Naval Cyber Forensic Analyst',
    short: 'Provost / Forensics',
    rank: 'Lt. Commander (Cyber Provost)',
    blurb: 'Naval Cyber Cell: Traces leaked media, DWT extraction, issues Sec 65B/63 BSA Court Dossier. Zero decrypt rights.',
    badge: 'bg-amber-950/80 text-amber-300 border border-amber-500/30',
    tint: 'bg-amber-500',
    demo: { email: 'provost@navy.gov.in', password: 'analyst123' },
  },
  NAVAL_AUDITOR: {
    label: 'Naval Audit & Oversight Authority',
    short: 'JAG / Oversight',
    rank: 'Commodore (JAG Dept)',
    blurb: 'Judge Advocate General: Zero-knowledge verification of immutable DLT ledger and cryptographic hash-chains.',
    badge: 'bg-purple-950/80 text-purple-300 border border-purple-500/30',
    tint: 'bg-purple-500',
    demo: { email: 'jag@navy.gov.in', password: 'audit123' },
  },
  // Legacy Aliases
  ADMIN: {
    label: 'Cryptographic Custodian (Admin)',
    short: 'Custodian',
    rank: 'Signals HQ',
    blurb: 'Full custody: uploads, dispatches, investigations and audit trail.',
    badge: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
    tint: 'bg-emerald-500',
    demo: { email: 'admin@example.gov', password: 'admin123' },
  },
  OFFICER: {
    label: 'Tactical Recipient Officer',
    short: 'Tactical Officer',
    rank: 'Fleet Officer',
    blurb: 'Releases a watermarked copy to themselves. Cannot investigate.',
    badge: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30',
    tint: 'bg-cyan-500',
    demo: { email: 'u017@example.gov', password: 'officer123' },
  },
  INVESTIGATOR: {
    label: 'Naval Cyber Forensic Analyst',
    short: 'Forensic Analyst',
    rank: 'Provost Cell',
    blurb: 'Traces leaked files. Cannot decrypt, so cannot manufacture evidence.',
    badge: 'bg-amber-950/80 text-amber-300 border border-amber-500/30',
    tint: 'bg-amber-500',
    demo: { email: 'a004@example.gov', password: 'analyst123' },
  },
};

export const ROLE_ORDER = [
  'CRYPTO_CUSTODIAN',
  'TACTICAL_OFFICER',
  'FORENSIC_ANALYST',
  'NAVAL_AUDITOR',
];

/**
 * Demo accounts for one-click evaluation in Indian Navy (WESEE) context.
 */
export const DEMO_ACCOUNTS = [
  {
    role: 'CRYPTO_CUSTODIAN',
    short: 'Custodian',
    badge: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
    title: 'Cryptographic Custodian',
    name: 'Cdr. S. Sharma',
    dept: 'WESEE Signals HQ',
    email: 'custodian@navy.gov.in',
    password: 'custodian123',
    desc: 'Originates broadcast dispatches & manages PQC keys',
  },
  {
    role: 'TACTICAL_OFFICER',
    short: 'CO Vikrant',
    badge: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30',
    title: 'Tactical Recipient Officer',
    name: 'Capt. R. Mehta',
    dept: 'INS Vikrant Strike Group',
    email: 'co.vikrant@navy.gov.in',
    password: 'officer123',
    desc: 'Decrypts operational dispatches, signs with ML-DSA',
  },
  {
    role: 'FORENSIC_ANALYST',
    short: 'Provost',
    badge: 'bg-amber-950/80 text-amber-300 border border-amber-500/30',
    title: 'Naval Cyber Forensic Analyst',
    name: 'Lt. Cdr. V. Nair',
    dept: 'Naval Provost / Cyber Cell',
    email: 'provost@navy.gov.in',
    password: 'analyst123',
    desc: 'Traces leaks & generates Section 65B/63 BSA Dossier',
  },
  {
    role: 'NAVAL_AUDITOR',
    short: 'JAG Auditor',
    badge: 'bg-purple-950/80 text-purple-300 border border-purple-500/30',
    title: 'Naval Audit Authority',
    name: 'Cmde. A. Verma',
    dept: 'Judge Advocate General Dept',
    email: 'jag@navy.gov.in',
    password: 'audit123',
    desc: 'Zero-knowledge verification of immutable DLT ledger',
  },
  // Recipient Officers for Multi-Officer Dispatch & Evaluation
  {
    role: 'OFFICER',
    short: 'Officer U-017',
    badge: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30',
    title: 'Tactical Clearance Holder',
    name: 'Officer U-017',
    dept: 'Ops Wing',
    email: 'u017@example.gov',
    password: 'officer123',
    desc: 'Recipient Officer 1 · Ops Wing',
  },
  {
    role: 'OFFICER',
    short: 'Officer U-023',
    badge: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30',
    title: 'Tactical Clearance Holder',
    name: 'Officer U-023',
    dept: 'Signals',
    email: 'u023@example.gov',
    password: 'officer123',
    desc: 'Recipient Officer 2 · Signals',
  },
  {
    role: 'OFFICER',
    short: 'Officer U-041',
    badge: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30',
    title: 'Tactical Clearance Holder',
    name: 'Officer U-041',
    dept: 'Logistics',
    email: 'u041@example.gov',
    password: 'officer123',
    desc: 'Recipient Officer 3 · Logistics',
  },
  {
    role: 'ADMIN',
    short: 'Admin Desk',
    badge: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
    title: 'Registry Administrator',
    name: 'Admin Desk',
    dept: 'HQ',
    email: 'admin@example.gov',
    password: 'admin123',
    desc: 'Legacy administrator account',
  },
];

/** Initials for the avatar — "Officer U-017" -> "OU". */
export function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
