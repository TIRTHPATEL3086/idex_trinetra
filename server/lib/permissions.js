/**
 * Who may do what — the single source of truth.
 *
 * The API enforces this table; the frontend reads the same capability list off
 * `GET /api/auth/me` and hides what it cannot do. Those are two different jobs:
 * hiding a button is a courtesy, refusing the request is the control. Nothing
 * in the client is trusted to decide either way.
 *
 * The separation is the point, not decoration:
 *
 *   INVESTIGATOR cannot decrypt — the person who examines the evidence must
 *   never be able to mint a marked copy, or they could manufacture the leak
 *   they then "discover".
 *
 *   OFFICER cannot trace, and may only release a copy to THEMSELVES — nobody
 *   investigates their own leak, and nobody issues a marked copy in someone
 *   else's name.
 *
 *   AUDITOR holds neither, and sees everything after the fact.
 */

/**
 * Who may do what — the single source of truth for Indian Navy (WESEE) Decryption Provenance.
 *
 * Strict Military Separation of Duties:
 *   - FORENSIC_ANALYST (Provost/Cyber Cell) cannot decrypt — cannot manufacture or mint evidence.
 *   - TACTICAL_OFFICER (CO/Recipient) cannot trace, and only releases/decrypts to THEMSELVES.
 *   - CRYPTO_CUSTODIAN (Signals HQ) originates dispatches, manages keys and roster, but cannot investigate.
 *   - NAVAL_AUDITOR (JAG/Oversight) holds zero-knowledge audit privileges: verifies immutable DLT ledger
 *     integrity without decrypting classified plaintext.
 */

export const DEFENSE_ROLES = {
  CRYPTO_CUSTODIAN: 'CRYPTO_CUSTODIAN',
  TACTICAL_OFFICER: 'TACTICAL_OFFICER',
  FORENSIC_ANALYST: 'FORENSIC_ANALYST',
  NAVAL_AUDITOR: 'NAVAL_AUDITOR',
};

export const ROLES = [
  'CRYPTO_CUSTODIAN',
  'TACTICAL_OFFICER',
  'FORENSIC_ANALYST',
  'NAVAL_AUDITOR',
  // Backward-compatible legacy aliases
  'ADMIN',
  'OFFICER',
  'INVESTIGATOR',
];

/** Normalize role to canonical defense role */
export function normalizeRole(role) {
  if (!role) return 'TACTICAL_OFFICER';
  const r = String(role).toUpperCase();
  if (r === 'ADMIN') return 'CRYPTO_CUSTODIAN';
  if (r === 'OFFICER') return 'TACTICAL_OFFICER';
  if (r === 'INVESTIGATOR') return 'FORENSIC_ANALYST';
  if (r === 'AUDITOR') return 'NAVAL_AUDITOR';
  return r;
}

/** Capability -> the roles that hold it. */
export const CAPABILITIES = {
  'assets:read': ['CRYPTO_CUSTODIAN', 'TACTICAL_OFFICER', 'FORENSIC_ANALYST', 'NAVAL_AUDITOR', 'ADMIN', 'OFFICER', 'INVESTIGATOR'],
  'assets:upload': ['CRYPTO_CUSTODIAN', 'ADMIN'],
  'decrypt:any': ['CRYPTO_CUSTODIAN', 'ADMIN'], // Originator dispatch testing
  'decrypt:self': ['TACTICAL_OFFICER', 'OFFICER', 'CRYPTO_CUSTODIAN', 'ADMIN'], // Tactical recipient release
  'trace:run': ['FORENSIC_ANALYST', 'INVESTIGATOR'], // STRICT: Custodian cannot trace
  'trace:history': ['FORENSIC_ANALYST', 'INVESTIGATOR', 'NAVAL_AUDITOR', 'CRYPTO_CUSTODIAN', 'ADMIN'],
  'audit:read': ['NAVAL_AUDITOR', 'CRYPTO_CUSTODIAN', 'FORENSIC_ANALYST', 'ADMIN', 'INVESTIGATOR'],
  'audit:own': ['TACTICAL_OFFICER', 'OFFICER', 'CRYPTO_CUSTODIAN', 'ADMIN', 'FORENSIC_ANALYST', 'INVESTIGATOR', 'NAVAL_AUDITOR'],
  'ledger:verify': ['NAVAL_AUDITOR', 'CRYPTO_CUSTODIAN', 'FORENSIC_ANALYST', 'ADMIN'],
  'metrics:read': ['CRYPTO_CUSTODIAN', 'TACTICAL_OFFICER', 'FORENSIC_ANALYST', 'NAVAL_AUDITOR', 'ADMIN', 'OFFICER', 'INVESTIGATOR'],
  'users:read': ['CRYPTO_CUSTODIAN', 'ADMIN', 'FORENSIC_ANALYST', 'INVESTIGATOR', 'NAVAL_AUDITOR'],
  'users:write': ['CRYPTO_CUSTODIAN', 'ADMIN'],
  'keys:manage': ['CRYPTO_CUSTODIAN', 'ADMIN'],
};

/** Human labels, reused by the login screen and the role badge. */
export const ROLE_META = {
  CRYPTO_CUSTODIAN: {
    label: 'Cryptographic Custodian',
    blurb: 'WESEE Signals HQ: Originates dispatches, multi-recipient ML-KEM broadcast encryption, manages key roster.',
    rank: 'Commander / Signals Officer (WESEE)',
  },
  TACTICAL_OFFICER: {
    label: 'Tactical Recipient Officer',
    blurb: 'Naval Operations: Decrypts authorized dispatches with personal ML-KEM private key, signs with ML-DSA.',
    rank: 'Commanding Officer / Watchkeeper (Fleet)',
  },
  FORENSIC_ANALYST: {
    label: 'Naval Cyber Forensic Analyst',
    blurb: 'Naval Provost & Cyber Command: Traces leaked media, DWT extraction, issues Sec 65B/63 BSA Court Dossier.',
    rank: 'Provost Marshal / Cyber Forensic Examiner',
  },
  NAVAL_AUDITOR: {
    label: 'Naval Audit & Oversight Authority',
    blurb: 'Judge Advocate General (JAG): Zero-knowledge verification of immutable DLT ledger and hash-chains.',
    rank: 'Judge Advocate General / Naval Oversight Inspector',
  },
  // Legacy aliases
  ADMIN: {
    label: 'Cryptographic Custodian (Admin)',
    blurb: 'WESEE Signals HQ: Originates dispatches and manages key roster.',
    rank: 'Signals Custodian',
  },
  OFFICER: {
    label: 'Tactical Recipient Officer',
    blurb: 'Releases a watermarked copy to themselves. Cannot investigate.',
    rank: 'Tactical Officer',
  },
  INVESTIGATOR: {
    label: 'Naval Cyber Forensic Analyst',
    blurb: 'Traces a leaked file back to the copy it came from. Holds no decrypt capability.',
    rank: 'Forensic Analyst',
  },
};

/** @returns {boolean} */
export function can(role, capability) {
  const norm = normalizeRole(role);
  const holders = CAPABILITIES[capability];
  if (!Array.isArray(holders)) return false;
  return holders.includes(norm) || holders.includes(role);
}

/** Every capability a role holds — sent to the client on login. */
export function capabilitiesOf(role) {
  const norm = normalizeRole(role);
  return Object.keys(CAPABILITIES).filter((c) => can(norm, c));
}

/**
 * The first screen a role should land on after signing in.
 */
export const LANDING = {
  CRYPTO_CUSTODIAN: '/assets',
  ADMIN: '/assets',
  TACTICAL_OFFICER: '/decrypt',
  OFFICER: '/decrypt',
  FORENSIC_ANALYST: '/trace',
  INVESTIGATOR: '/trace',
  NAVAL_AUDITOR: '/history',
  AUDITOR: '/history',
};

