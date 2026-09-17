/**
 * The one place the frontend talks to B's API. Owner: C.
 *
 * Every function here mirrors docs/CONTRACTS.md §3 exactly. If a response shape
 * ever surprises you, check that file first — it is frozen, and B keeps the
 * server matching it.
 *
 * VITE_USE_MOCKS=true serves `public/mocks/*.json` instead, so the UI keeps
 * working even when the backend is down. That flag is the insurance policy
 * (§7.5) — keep it working until the very last minute.
 */

const BASE = import.meta.env.VITE_API_BASE || '';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

/** Every route fails in the same shape: { error: { code, message } }. */
export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path, options = {}) {
  if (USE_MOCKS) return mockFor(path, options);

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

/**
 * @param {File}   file
 * @param {string} [forceVerdict] dev only — 'probable' | 'inconclusive'.
 *        Works while B has MOCK_MODE on, so all three verdict screens can be
 *        built and reviewed before the real pipeline exists.
 */
export function traceFile(file, forceVerdict) {
  const form = new FormData();
  form.append('file', file);
  const qs = forceVerdict ? `?mockVerdict=${forceVerdict}` : '';
  return request(`/api/trace${qs}`, { method: 'POST', body: form });
}

export const getAudit = (assetId) => request(`/api/audit/${assetId}`);

export const getMetrics = () => request('/api/metrics');

export const markedFileUrl = (downloadUrl) => `${BASE}${downloadUrl}`;

// ---------------------------------------------------------------- mocks ----

async function mockFor(path, options) {
  const file = path.startsWith('/api/audit')
    ? 'audit'
    : path.startsWith('/api/trace')
      ? 'trace'
      : path.startsWith('/api/decrypt')
        ? 'decrypt'
        : path.startsWith('/api/assets') && options.method !== 'POST'
          ? 'assets'
          : path.startsWith('/api/users')
            ? 'users'
            : path.startsWith('/api/metrics')
              ? 'metrics'
              : 'health';

  // Watermarking really is slow — practise with the delay so the loading copy
  // gets designed properly rather than bolted on later (§7.2 rule 6).
  await new Promise((r) => setTimeout(r, 400));
  const res = await fetch(`/mocks/${file}.json`);
  return res.json();
}

// ------------------------------------------------------------- helpers ----

export const VERDICT_STYLE = {
  ATTRIBUTED: { label: 'Attributed', color: 'text-attributed', ring: 'ring-attributed' },
  PROBABLE: { label: 'Probable', color: 'text-probable', ring: 'ring-probable' },
  INCONCLUSIVE: { label: 'Inconclusive', color: 'text-inconclusive', ring: 'ring-inconclusive' },
};

/** 0x7f2c8b41… — use this everywhere a hash appears. Never print the full 66. */
export const shortHash = (hex, lead = 6, tail = 4) =>
  !hex ? '—' : hex.length <= lead + tail + 2 ? hex : `${hex.slice(0, lead + 2)}…${hex.slice(-tail)}`;
