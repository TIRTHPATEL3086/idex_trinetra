/**
 * The only place the frontend talks to the API.
 *
 * In development Vite proxies `/api` to the Express server on :4000, so no
 * base URL is needed. Set `VITE_API_BASE` only when the backend lives
 * elsewhere (a deployed URL, a different port).
 */

const BASE = import.meta.env.VITE_API_BASE || '';

/** Every route fails in the same shape: { error: { code, message } }. */
export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Listeners notified when the API says the session is gone, so a 401 in any
 * corner of the app lands the user back on the sign-in screen instead of
 * showing an error they cannot act on.
 */
const sessionLostHandlers = new Set();
export function onSessionLost(fn) {
  sessionLostHandlers.add(fn);
  return () => sessionLostHandlers.delete(fn);
}

async function request(path, options = {}) {
  // Always send the session cookie — it is httpOnly, so this is the only way
  // the browser will attach it, and it is what every guarded route reads.
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...options });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const err = body?.error;
    // 401 on anything other than the session probe itself means the cookie
    // expired mid-session; tell the app so it can show the login screen.
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      for (const fn of sessionLostHandlers) fn();
    }
    throw new ApiError(err?.code || 'INTERNAL', err?.message || res.statusText, res.status);
  }
  return body;
}

// ------------------------------------------------------------ endpoints ----

export const getHealth = () => request('/api/health');

// ------------------------------------------------------------------ auth ---

export const login = (email, password, extra = {}) =>
  request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, ...extra }),
  });

export const logout = () => request('/api/auth/logout', { method: 'POST' });

/** Who am I — called once on boot to restore a session from the cookie. */
export const getMe = () => request('/api/auth/me');

export const getAssets = () => request('/api/assets');

export const getAsset = (assetId) => request(`/api/assets/${assetId}`);

export const getUsers = () => request('/api/users');

export function uploadAsset({ file, title, classification, authorizedUserIds }) {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  if (classification) form.append('classification', classification);
  if (authorizedUserIds && authorizedUserIds.length > 0) {
    form.append('authorizedUserIds', JSON.stringify(authorizedUserIds));
  }
  return request('/api/assets', { method: 'POST', body: form });
}

export const getPqcPublicKey = (userId) => request(`/api/keys/public/${userId}`);
export const getPqcKeyBundle = () => request('/api/keys/bundle');
export const generatePqcKeys = (passphrase, userId) =>
  request('/api/keys/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userId ? { passphrase, userId: Number(userId) } : { passphrase }),
  });

/** Request a signing challenge nonce for client-side ML-DSA-65 non-repudiation. */
export const requestDecryptChallenge = ({ assetId, userId }) =>
  request('/api/decrypt/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, userId }),
  });

export const decryptAsset = ({
  assetId,
  userId,
  deviceLabel,
  passphrase,
  clientSignature,
  challengeId,
  securityAnswer,
  newSecurityQuestion,
  newSecurityAnswer,
}) =>
  request('/api/decrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assetId,
      userId,
      deviceLabel,
      passphrase,
      clientSignature,
      challengeId,
      securityAnswer,
      newSecurityQuestion,
      newSecurityAnswer,
    }),
  });

export const getSecurityQuestion = () => request('/api/users/security-question');

export const setSecurityQuestion = ({ securityQuestion, securityAnswer }) =>
  request('/api/users/security-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ securityQuestion, securityAnswer }),
  });

export const batchDecryptAsset = ({
  assetId,
  userIds,
  passphraseMode,
  commonPassphrase,
  individualPassphrases,
  deviceLabel,
}) =>
  request('/api/decrypt/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assetId,
      userIds,
      passphraseMode,
      commonPassphrase,
      individualPassphrases,
      deviceLabel,
    }),
  });

/** Released copies of a document — administrators only. */
export const getReleases = (assetId) => request(`/api/decrypt/releases/${assetId}`);

/**
 * Recover the watermark from a stored copy and check it against the record.
 * Reads the file; it never alters it, so the released copy is untouched.
 */
export const inspectRelease = (receiptId) =>
  request(`/api/decrypt/inspect/${String(receiptId).replace(/^0x/, '')}`, { method: 'POST' });

export const getAllotments = (assetId) => request(`/api/decrypt/allotments/${assetId}`);

/**
 * Reveal your own allotted passphrase for a document. Takes the account
 * password because a live session alone should not read out a clearance
 * secret; `userId` is only honoured for roles that may release on someone
 * else's behalf.
 */
export const revealAllotment = (assetId, password, userId) =>
  request(`/api/decrypt/allotments/${assetId}/reveal${userId ? `?userId=${userId}` : ''}`, {
    method: 'POST',
    // `request` does not add this; without it Express's json parser skips the
    // body and the route sees no password at all.
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

/**
 * Trace a leaked file. With `lens`, the server first flattens a photo of a
 * screen; `corners` (TL, TR, BR, BL in the photo's pixels) override its own
 * corner detection.
 */
export function traceFile(file, { lens = false, corners = null, lensMode = null } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (lens) form.append('lens', '1');
  if (lens && corners) form.append('corners', JSON.stringify(corners));
  if (lensMode) form.append('lensMode', lensMode);
  return request('/api/trace', { method: 'POST', body: form });
}

/** Find a displayed document's corners in a photo, for the lens editor. */
export function detectLensCorners(file) {
  const form = new FormData();
  form.append('file', file);
  return request('/api/trace/lens/detect', { method: 'POST', body: form });
}

export const getInvestigations = () => request('/api/trace/investigations');

export const getAudit = (assetId) => request(`/api/audit/${assetId}`);

export const toggleUserActive = (userId) =>
  request(`/api/users/${userId}/toggle-active`, { method: 'POST' });

/** Administrator: assign a new officer their login ID and password. */
export const createOfficer = ({ name, dept, email, password }) =>
  request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dept, email, password }),
  });

/** Administrator: assign a new password to an officer or analyst. */
export const setUserPassword = (userId, password) =>
  request(`/api/users/${userId}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

export const getMetrics = (classification) =>
  request(
    `/api/metrics${classification && classification !== 'ALL' ? `?classification=${classification}` : ''}`
  );

export const markedFileUrl = (downloadUrl) => `${BASE}${downloadUrl}`;

// -------------------------------------------------------------- display ----

/**
 * Verdict presentation. Deliberately never red: the system reports a
 * likelihood, it does not accuse anyone, and an inconclusive result is a
 * legitimate answer rather than an error state.
 */
export const VERDICT_STYLE = {
  ATTRIBUTED: { label: 'Attributed', color: 'text-attributed', ring: 'ring-attributed' },
  PROBABLE: { label: 'Probable', color: 'text-probable', ring: 'ring-probable' },
  INCONCLUSIVE: { label: 'Inconclusive', color: 'text-inconclusive', ring: 'ring-inconclusive' },
};

/** 0x7f2c8b41…d037 — use everywhere a hash is displayed. */
export const shortHash = (hex, lead = 6, tail = 4) =>
  !hex
    ? '—'
    : hex.length <= lead + tail + 2
      ? hex
      : `${hex.slice(0, lead + 2)}…${hex.slice(-tail)}`;
