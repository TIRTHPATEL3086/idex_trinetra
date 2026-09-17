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

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(err?.code || 'INTERNAL', err?.message || res.statusText, res.status);
  }
  return body;
}

// ------------------------------------------------------------ endpoints ----

export const getHealth = () => request('/api/health');

export const getAssets = () => request('/api/assets');

export const getAsset = (assetId) => request(`/api/assets/${assetId}`);

export const getUsers = () => request('/api/users');

export function uploadAsset({ file, title, classification }) {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  if (classification) form.append('classification', classification);
  return request('/api/assets', { method: 'POST', body: form });
}

export const decryptAsset = ({ assetId, userId, deviceLabel }) =>
  request('/api/decrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, userId, deviceLabel }),
  });

export function traceFile(file) {
  const form = new FormData();
  form.append('file', file);
  return request('/api/trace', { method: 'POST', body: form });
}

export const getInvestigations = () => request('/api/trace/investigations');

export const getAudit = (assetId) => request(`/api/audit/${assetId}`);

export const getMetrics = () => request('/api/metrics');

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
