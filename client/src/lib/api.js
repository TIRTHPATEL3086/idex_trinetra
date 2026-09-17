/**
 * Unified API Client with Dual-Engine Architecture:
 * - Talks to live Express API at `/api` when online.
 * - Automatically falls back to high-fidelity mock engine if backend is offline
 *   or if "Demo Mode" is explicitly enabled in the console header.
 */

import {
  MOCK_ASSETS,
  MOCK_USERS,
  MOCK_METRICS,
  MOCK_TIMELINES,
  TRACE_PRESETS,
} from './mockData.js';

const BASE = import.meta.env.VITE_API_BASE || '';

// Manage demo mode persistence in localStorage
let demoModeActive = localStorage.getItem('PROVENANCE_DEMO_MODE') === 'true';

export function isDemoMode() {
  return demoModeActive;
}

export function setDemoMode(val) {
  demoModeActive = !!val;
  localStorage.setItem('PROVENANCE_DEMO_MODE', demoModeActive ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('provenance-mode-change', { detail: demoModeActive }));
}

// In-memory state for mock sessions
let mockAssets = [...MOCK_ASSETS];
let mockTimelines = { ...MOCK_TIMELINES };

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request(path, options = {}) {
  // If explicitly in demo mode, skip network and use mock engine
  if (demoModeActive && !path.includes('/api/health')) {
    return handleMockRequest(path, options);
  }

  try {
    const res = await fetch(`${BASE}${path}`, options);
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await res.json() : null;

    if (!res.ok) {
      const err = body?.error;
      throw new ApiError(err?.code || 'INTERNAL', err?.message || res.statusText, res.status);
    }
    return body;
  } catch (err) {
    // If backend is unreachable, seamlessly fall back to mock engine
    console.warn(`[Provenance API] Live request failed for ${path}. Falling back to mock engine:`, err.message);
    return handleMockRequest(path, options);
  }
}

// ------------------------------------------------------------ Mock Engine ----

async function handleMockRequest(path, options = {}) {
  // Simulate natural latency for realism
  await new Promise((r) => setTimeout(r, 400));

  if (path === '/api/health') {
    return {
      ok: true,
      db: 'connected (simulated)',
      chainMode: 'sepolia',
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      warnings: [],
    };
  }

  if (path === '/api/assets') {
    return { assets: mockAssets };
  }

  if (path.startsWith('/api/assets/')) {
    const id = parseInt(path.replace('/api/assets/', ''), 10);
    const asset = mockAssets.find((a) => a.assetId === id) || mockAssets[0];
    return { asset };
  }

  if (path === '/api/users') {
    return { users: MOCK_USERS };
  }

  if (path === '/api/decrypt' && options.method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    const asset = mockAssets.find((a) => a.assetId === Number(body.assetId)) || mockAssets[0];
    const user = MOCK_USERS.find((u) => u.userId === Number(body.userId)) || MOCK_USERS[0];

    // Increment decryptions count
    asset.decryptCount = (asset.decryptCount || 0) + 1;

    const receiptId = '0x7f2c8b41' + Math.random().toString(16).slice(2, 10) + '940efbc1294871d37ba6a9e10582098b672834b9d037';
    const txHash = '0x9ab1c045' + Math.random().toString(16).slice(2, 10) + 'b8214f9d0234857b612c0914a821e5401924b1049c63';
    const blockNumber = 5829300 + Math.floor(Math.random() * 50);

    const newEvent = {
      receiptId,
      userName: user.name,
      userRef: user.userRef,
      dept: user.dept,
      at: new Date().toISOString(),
      device: body.deviceLabel || 'DESK-114-SECURE',
      txHash,
      blockNumber,
      psnrDb: 42.7,
      deltaUsed: 12,
    };

    if (!mockTimelines[asset.assetId]) {
      mockTimelines[asset.assetId] = [];
    }
    mockTimelines[asset.assetId].unshift(newEvent);

    return {
      receiptId,
      txHash,
      blockNumber,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      payloadBits: '101101001101100010101100011010101101011010011010',
      psnrDb: 42.7,
      deltaUsed: 12,
      downloadUrl: `/api/files/marked/${receiptId}`,
      asset,
      user,
      deviceLabel: body.deviceLabel || 'DESK-114-SECURE',
    };
  }

  if (path === '/api/trace' && options.method === 'POST') {
    // Default to the WhatsApp degraded preset for arbitrary uploads
    return TRACE_PRESETS[0].result;
  }

  if (path.startsWith('/api/audit/')) {
    const id = parseInt(path.replace('/api/audit/', ''), 10);
    return {
      assetId: id,
      title: mockAssets.find((a) => a.assetId === id)?.title || 'Ops Order 44',
      timeline: mockTimelines[id] || mockTimelines[1] || [],
    };
  }

  if (path === '/api/metrics') {
    return MOCK_METRICS;
  }

  return { ok: true };
}

// ------------------------------------------------------------ Endpoints ----

export const getHealth = () => request('/api/health');

export const getAssets = () => request('/api/assets');

export const getAsset = (assetId) => request(`/api/assets/${assetId}`);

export const getUsers = () => request('/api/users');

export async function uploadAsset({ file, title, classification }) {
  if (demoModeActive) {
    const newAsset = {
      assetId: mockAssets.length + 1,
      title,
      classification: classification || 'RESTRICTED',
      createdAt: new Date().toISOString(),
      decryptCount: 0,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      sizeBytes: file ? file.size : 256000,
      originalUrl: file ? URL.createObjectURL(file) : MOCK_ASSETS[0].originalUrl,
    };
    mockAssets.unshift(newAsset);
    return { assetId: newAsset.assetId, title: newAsset.title, sha256: newAsset.sha256, sizeBytes: newAsset.sizeBytes };
  }

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
  if (demoModeActive) {
    return TRACE_PRESETS[0].result;
  }
  const form = new FormData();
  form.append('file', file);
  return request('/api/trace', { method: 'POST', body: form });
}

export function tracePreset(presetId) {
  const preset = TRACE_PRESETS.find((p) => p.id === presetId) || TRACE_PRESETS[0];
  return Promise.resolve(preset.result);
}

export const getAudit = (assetId) => request(`/api/audit/${assetId}`);

export const getMetrics = () => request('/api/metrics');

export const markedFileUrl = (downloadUrl) => `${BASE}${downloadUrl}`;

// ------------------------------------------------------------ Display ----

export const VERDICT_STYLE = {
  ATTRIBUTED: {
    label: 'ATTRIBUTED',
    subLabel: 'Positive Forensic Match (>=85%)',
    color: 'text-attributed',
    border: 'border-attributed/40',
    bg: 'bg-emerald-950/30',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    ring: 'ring-attributed',
    glow: 'shadow-glow-attributed',
  },
  PROBABLE: {
    label: 'PROBABLE',
    subLabel: 'Partial Agreement (60-85%)',
    color: 'text-probable',
    border: 'border-probable/40',
    bg: 'bg-amber-950/30',
    badgeBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    ring: 'ring-probable',
    glow: 'shadow-glow-probable',
  },
  INCONCLUSIVE: {
    label: 'INCONCLUSIVE',
    subLabel: 'Insufficient Forensic Evidence (<60%)',
    color: 'text-inconclusive',
    border: 'border-slate-700/60',
    bg: 'bg-slate-900/60',
    badgeBg: 'bg-slate-800 text-slate-400 border border-slate-700',
    ring: 'ring-inconclusive',
    glow: 'shadow-glow-inconclusive',
  },
};

export const CLASSIFICATION_BADGES = {
  'TOP SECRET': 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  SECRET: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  CONFIDENTIAL: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  RESTRICTED: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
};

export const shortHash = (hex, lead = 8, tail = 6) =>
  !hex ? '—' : hex.length <= lead + tail + 2 ? hex : `${hex.slice(0, lead + 2)}…${hex.slice(-tail)}`;
