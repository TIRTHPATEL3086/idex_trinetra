/**
 * MOCK FIXTURES — owner: B. Deliverable B6-at-Hour-8.
 *
 * These are the exact payloads from docs/CONTRACTS.md §3, verbatim. With
 * MOCK_MODE=true every route answers from here, which means Person C is fully
 * unblocked at Hour 8 and never waits for the backend again.
 *
 * RULE: if a fixture here and the real route ever disagree in shape, the
 * fixture is wrong — fix the fixture, not C's code. These are the contract.
 *
 * DELETE at Hour 28 (feature freeze), when no mocks are left.
 */

export const mockAssets = [
  {
    assetId: 12,
    title: 'Ops Order 44',
    classification: 'CONFIDENTIAL',
    createdAt: '2026-03-12T14:22:00Z',
    decryptCount: 7,
  },
  {
    assetId: 13,
    title: 'Border Survey Sheet 7',
    classification: 'SECRET',
    createdAt: '2026-03-11T09:05:00Z',
    decryptCount: 2,
  },
  {
    assetId: 14,
    title: 'Logistics Annexure B',
    classification: 'RESTRICTED',
    createdAt: '2026-03-10T17:40:00Z',
    decryptCount: 0,
  },
];

export const mockUsers = [
  { userId: 1, name: 'Officer U-017', dept: 'Ops Wing', userRef: '0x8f3a19c4d2e7b6a5' },
  { userId: 2, name: 'Officer U-023', dept: 'Signals', userRef: '0x2b7e44f1a908c3d6' },
  { userId: 3, name: 'Officer U-041', dept: 'Logistics', userRef: '0xc10d92aa5e4471bf' },
  { userId: 4, name: 'Analyst A-004', dept: 'Intel Cell', userRef: '0x59ff03be7c2d1a88' },
  { userId: 5, name: 'Admin Desk', dept: 'HQ', userRef: '0xe4a6cc0187d53b92' },
];

export const mockDecrypt = {
  receiptId: '0x7f2c8b41e93ad6570c1f2b8e4a97d3510fbc62e8a4d17395c0e8b2f61a4d9037',
  txHash: '0x9ab1c47e2d05f83b6a19cd4270ef58b3a6c91d02e74f5b8c3d19a06e2f47b8c5',
  blockNumber: 5829301,
  etherscanUrl:
    'https://sepolia.etherscan.io/tx/0x9ab1c47e2d05f83b6a19cd4270ef58b3a6c91d02e74f5b8c3d19a06e2f47b8c5',
  payloadBits: '101100101110010011010110100111000101101110100101',
  psnrDb: 42.7,
  deltaUsed: 12,
  downloadUrl: '/api/files/marked/7f2c8b41',
};

export const mockTraceAttributed = {
  investigationId: 31,
  verdict: 'ATTRIBUTED',
  confidence: 0.93,
  match: {
    userName: 'Officer U-017',
    department: 'Ops Wing',
    assetTitle: 'Ops Order 44',
    decryptedAt: '2026-03-12T14:22:00Z',
    deviceLabel: 'DESK-114',
    txHash: '0x9ab1c47e2d05f83b6a19cd4270ef58b3a6c91d02e74f5b8c3d19a06e2f47b8c5',
    etherscanUrl:
      'https://sepolia.etherscan.io/tx/0x9ab1c47e2d05f83b6a19cd4270ef58b3a6c91d02e74f5b8c3d19a06e2f47b8c5',
  },
  reasons: [
    '46/48 watermark bits recovered (2 fixed by Reed-Solomon)',
    'dHash distance 3/64',
    'on-chain receipt verified',
  ],
  candidatesChecked: 1284,
  elapsedMs: 812,
};

/**
 * C needs all three verdict states to build the screens. Hit
 * `POST /api/trace?mockVerdict=probable|inconclusive` to force one.
 * §7.2: the INCONCLUSIVE screen must look just as polished as ATTRIBUTED.
 */
export const mockTraceProbable = {
  investigationId: 32,
  verdict: 'PROBABLE',
  confidence: 0.71,
  match: {
    userName: 'Officer U-023',
    department: 'Signals',
    assetTitle: 'Border Survey Sheet 7',
    decryptedAt: '2026-03-11T09:05:00Z',
    deviceLabel: 'DESK-208',
    txHash: '0x4d72ba0e91c8f35a27ed60b1934cf7a8e25d09b6c1f483ae70d2b95c68e1af30',
    etherscanUrl:
      'https://sepolia.etherscan.io/tx/0x4d72ba0e91c8f35a27ed60b1934cf7a8e25d09b6c1f483ae70d2b95c68e1af30',
  },
  reasons: [
    '31/48 watermark bits recovered',
    'dHash distance 11/64',
    'on-chain receipt verified',
    'Confidence is below the 85% threshold — treat as a lead, not a conclusion.',
  ],
  candidatesChecked: 1284,
  elapsedMs: 940,
};

export const mockTraceInconclusive = {
  investigationId: 33,
  verdict: 'INCONCLUSIVE',
  confidence: 0.24,
  match: null,
  reasons: [
    '6/48 watermark bits recovered',
    'No perceptual-hash candidate within distance 12/64',
    'No matching on-chain receipt',
    'Below the 60% threshold — the system does not guess.',
  ],
  candidatesChecked: 1284,
  elapsedMs: 604,
};

export const mockAudit = {
  assetId: 12,
  timeline: [
    {
      receiptId: '0x7f2c8b41e93ad6570c1f2b8e4a97d3510fbc62e8a4d17395c0e8b2f61a4d9037',
      userName: 'Officer U-017',
      at: '2026-03-12T14:22:00Z',
      device: 'DESK-114',
      txHash: '0x9ab1c47e2d05f83b6a19cd4270ef58b3a6c91d02e74f5b8c3d19a06e2f47b8c5',
      psnrDb: 42.7,
    },
    {
      receiptId: '0x1e93c2f7a40db85691cf03e27a4d85b16fc0927ae53d1846b0f92c7e35a1d804',
      userName: 'Officer U-023',
      at: '2026-03-12T11:07:00Z',
      device: 'DESK-208',
      txHash: '0x4d72ba0e91c8f35a27ed60b1934cf7a8e25d09b6c1f483ae70d2b95c68e1af30',
      psnrDb: 43.1,
    },
  ],
};

/**
 * Same shape A's `test/attack-suite.js` writes to `test/metrics.json`.
 * Targets from §5.3 — these are the numbers to beat, not the numbers we have.
 */
export const mockMetrics = {
  attacks: [
    { name: 'JPEG q90', survived: true, bitsRecovered: 48, psnrDb: 41.2 },
    { name: 'JPEG q75', survived: true, bitsRecovered: 47, psnrDb: 38.4 },
    { name: 'JPEG q60', survived: true, bitsRecovered: 45, psnrDb: 35.1 },
    { name: 'JPEG q45', survived: true, bitsRecovered: 43, psnrDb: 32.6 },
    { name: 'Resize 50%', survived: true, bitsRecovered: 44, psnrDb: null },
    { name: 'Crop 20%', survived: true, bitsRecovered: 41, psnrDb: null },
    { name: 'Gaussian noise', survived: true, bitsRecovered: 42, psnrDb: null },
    { name: 'Screenshot sim', survived: true, bitsRecovered: 40, psnrDb: null },
  ],
  psnrCurve: [
    { delta: 4, psnrDb: 51.2, bitsRecovered: 31 },
    { delta: 8, psnrDb: 46.8, bitsRecovered: 44 },
    { delta: 12, psnrDb: 42.7, bitsRecovered: 48 },
    { delta: 16, psnrDb: 39.1, bitsRecovered: 48 },
    { delta: 24, psnrDb: 34.0, bitsRecovered: 48 },
  ],
};

/** Picks the trace fixture for `?mockVerdict=`. Defaults to ATTRIBUTED. */
export function mockTraceFor(verdict) {
  switch (String(verdict || '').toLowerCase()) {
    case 'probable':
      return mockTraceProbable;
    case 'inconclusive':
      return mockTraceInconclusive;
    default:
      return mockTraceAttributed;
  }
}
