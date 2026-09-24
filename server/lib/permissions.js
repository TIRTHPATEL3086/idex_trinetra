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

export const ROLES = ['ADMIN', 'OFFICER', 'INVESTIGATOR'];

/** Capability -> the roles that hold it. */
export const CAPABILITIES = {
  'assets:read': ['ADMIN', 'OFFICER', 'INVESTIGATOR'],
  'assets:upload': ['ADMIN'],
  'decrypt:any': ['ADMIN'], //  release a copy in anyone's name
  'decrypt:self': ['ADMIN', 'OFFICER'], //  release a copy in your own name
  'trace:run': ['ADMIN', 'INVESTIGATOR'],
  'trace:history': ['ADMIN', 'INVESTIGATOR'],
  'audit:read': ['ADMIN', 'INVESTIGATOR'],
  'audit:own': ['ADMIN', 'OFFICER', 'INVESTIGATOR'],
  'metrics:read': ['ADMIN', 'OFFICER', 'INVESTIGATOR'],
  'users:read': ['ADMIN', 'INVESTIGATOR'],
  // Added alongside the roster work; only the registry administrator writes users.
  'users:write': ['ADMIN'],
};

/** Human labels, reused by the login screen and the role badge. */
export const ROLE_META = {
  ADMIN: {
    label: 'Registry Administrator',
    blurb: 'Full custody: uploads, releases, investigations and the audit trail.',
  },
  OFFICER: {
    label: 'Clearance Holder',
    blurb: 'Releases a watermarked copy to themselves. Cannot investigate.',
  },
  INVESTIGATOR: {
    label: 'Forensic Analyst',
    blurb: 'Traces a leaked file back to the copy it came from. Holds no decrypt capability.',
  },
};

/** @returns {boolean} */
export function can(role, capability) {
  const holders = CAPABILITIES[capability];
  return Array.isArray(holders) && holders.includes(role);
}

/** Every capability a role holds — sent to the client on login. */
export function capabilitiesOf(role) {
  return Object.keys(CAPABILITIES).filter((c) => can(role, c));
}

/**
 * The first screen a role should land on after signing in. An officer has no
 * business on /trace, so sending them there and then refusing would be a poor
 * welcome.
 */
export const LANDING = {
  ADMIN: '/assets',
  OFFICER: '/decrypt',
  // An analyst has no decrypt capability at all, so /decrypt would be an empty
  // screen; tracing is the whole of the job, so that is where they open.
  INVESTIGATOR: '/trace',
};
