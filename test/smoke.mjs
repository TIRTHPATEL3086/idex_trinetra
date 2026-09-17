/**
 * Smoke test for the parts of the pipeline that have no third-party deps.
 * Owner: B. Run it with `npm run test:smoke` — it needs no npm install, no
 * PostgreSQL and no chain, so it works on a fresh clone at the venue.
 *
 * Covers: the 48-bit payload codec, the BK-tree + Hamming metric, AES-256-GCM
 * (including tamper detection), and the confidence bands.
 * Does NOT cover Person A's real watermark — that is test/attack-suite.js.
 */
const B = '../';

process.env.ALLOW_CORE_FALLBACK = 'true';
process.env.MOCK_MODE = 'false';
process.env.CHAIN_MODE = 'off';

const payload = await import(B + 'server/core/payload.js');
const bktree = await import(B + 'server/core/bktree.js');
const fb = await import(B + 'server/core/fallback/index.js');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); fail++; }
};
const eq = (a, b, m) => { if (String(a) !== String(b)) throw new Error(`${m}: ${a} !== ${b}`); };

// ---- payload codec round-trip ----
const receiptId = '0x7f2c8b41e93ad6570c1f2b8e4a97d3510fbc62e8a4d17395c0e8b2f61a4d9037';
const bits = payload.buildPayload(receiptId, 1);
t('buildPayload is 48 bits of 0/1', () => {
  eq(bits.length, 48, 'length');
  if (/[^01]/.test(bits)) throw new Error('non-binary char');
});
t('parsePayload round-trips shortId + crc + version', () => {
  const p = payload.parsePayload(bits);
  eq(p.shortId, payload.shortIdOf(receiptId), 'shortId');
  eq(p.crcOk, true, 'crcOk');
  eq(p.version, 1, 'version');
});
t('a flipped bit fails CRC', () => {
  const bad = (bits[0] === '0' ? '1' : '0') + bits.slice(1);
  eq(payload.parsePayload(bad).crcOk, false, 'crc should fail');
});
t('bitAgreement / bitsMatching', () => {
  eq(payload.bitAgreement(bits, bits), 1, 'self agreement');
  eq(payload.bitsMatching(bits, bits), 48, 'self matching');
});

// ---- hamming + BK-tree ----
t('hamming is a real popcount', () => {
  eq(bktree.hamming(0n, 0n), 0, 'zero');
  eq(bktree.hamming(0n, 0xffffffffffffffffn), 64, 'all bits');
  eq(bktree.hamming(0b1011n, 0b1000n), 2, 'two bits');
});
t('BK-tree finds near neighbours and prunes far ones', () => {
  const tree = new bktree.BKTree('t');
  tree.insert(0b0000n, 1);
  tree.insert(0b0011n, 2);           // distance 2 from query 0
  tree.insert(0xffffffffffffffffn, 3); // distance 64 — must be pruned
  const hits = tree.search(0n, 4).map(h => h.id).sort();
  eq(JSON.stringify(hits), JSON.stringify([1, 2]), 'expected ids 1,2');
});

// ---- AES-256-GCM round trip ----
t('AES-256-GCM encrypt/decrypt round-trips', () => {
  const key = Buffer.alloc(32, 7);
  const plain = Buffer.from('ops order 44 — classified');
  const { ciphertext, iv, authTag } = fb.cryptoImpl.encrypt(plain, key);
  const out = fb.cryptoImpl.decrypt(ciphertext, key, iv, authTag);
  eq(out.toString(), plain.toString(), 'round trip');
});
t('GCM rejects a tampered ciphertext', () => {
  const key = Buffer.alloc(32, 7);
  const { ciphertext, iv, authTag } = fb.cryptoImpl.encrypt(Buffer.from('abc'), key);
  ciphertext[0] ^= 0xff;
  let threw = false;
  try { fb.cryptoImpl.decrypt(ciphertext, key, iv, authTag); } catch { threw = true; }
  if (!threw) throw new Error('tampering was not detected');
});

// ---- confidence formula + bands ----
t('confidence: perfect signal -> ATTRIBUTED', () => {
  const r = fb.confidenceImpl.score({ bitConfidence: 1, pHashDist: 0, dHashDist: 0, aHashDist: 0, chainVerified: true });
  eq(r.verdict, 'ATTRIBUTED', 'verdict');
  eq(r.score, 1, 'score');
  if (!r.reasons.length) throw new Error('reasons[] must never be empty');
});
t('confidence: no signal -> INCONCLUSIVE, no name', () => {
  const r = fb.confidenceImpl.score({ bitConfidence: 0, pHashDist: 64, dHashDist: 64, aHashDist: 64, chainVerified: false });
  eq(r.verdict, 'INCONCLUSIVE', 'verdict');
  eq(r.score, 0, 'score');
});
t('confidence: middle band -> PROBABLE', () => {
  const r = fb.confidenceImpl.score({ bitConfidence: 0.7, pHashDist: 10, dHashDist: 8, aHashDist: 14, chainVerified: true });
  eq(r.verdict, 'PROBABLE', `verdict (score=${r.score})`);
});

// ---- watermark stand-in round trip ----
t('watermark stand-in embeds and extracts the same 48 bits', async () => {});
const png = Buffer.from('89504e470d0a1a0a-fake-image-bytes');
const emb = await fb.watermarkImpl.embed(png, bits, 12);
const ext = await fb.watermarkImpl.extract(emb.buffer);
t('stand-in watermark round-trips', () => {
  eq(ext.payloadBits, bits, 'payload');
  eq(ext.bitConfidence, 1, 'confidence');
});
t('stand-in extract on an unmarked file returns zero confidence', async () => {});
const clean = await fb.watermarkImpl.extract(png);
t('unmarked file -> bitConfidence 0', () => eq(clean.bitConfidence, 0, 'confidence'));

const h1 = await fb.phashImpl.hashes(png);
const h2 = await fb.phashImpl.hashes(emb.buffer);
t('stand-in phash ignores the trailer (original and marked hash alike)', () => {
  eq(h1.pHash, h2.pHash, 'pHash');
  eq(h1.dHash, h2.dHash, 'dHash');
});

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
