/**
 * Smoke test for the dependency-free parts of the pipeline: the 48-bit payload
 * codec, the BK-tree and its Hamming metric, and the ref-hashing helpers.
 *
 * Run it with `npm run test:smoke`. It needs no npm install, no PostgreSQL and
 * no chain, so it works on a fresh clone — which makes it the first thing to
 * run when something looks broken.
 *
 * The watermark itself is covered by `npm run attack:suite`, not here.
 */

import nodeCrypto from 'node:crypto';
import * as payload from '../server/core/payload.js';
import * as bktree from '../server/core/bktree.js';

let pass = 0;
let fail = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`  ok   ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL ${name}\n       ${err.message}`);
    fail++;
  }
};

const eq = (actual, expected, what) => {
  if (String(actual) !== String(expected)) {
    throw new Error(`${what}: expected ${expected}, got ${actual}`);
  }
};

console.log('\n  smoke test\n');

// ------------------------------------------------------- payload codec -----

const RECEIPT_ID = '0x7f2c8b41e93ad6570c1f2b8e4a97d3510fbc62e8a4d17395c0e8b2f61a4d9037';
const bits = payload.buildPayload(RECEIPT_ID, 1);

test('buildPayload returns exactly 48 binary characters', () => {
  eq(bits.length, payload.PAYLOAD_BITS, 'length');
  if (/[^01]/.test(bits)) throw new Error('payload contains a non-binary character');
});

test('parsePayload round-trips shortId, CRC and version', () => {
  const parsed = payload.parsePayload(bits);
  eq(parsed.shortId, payload.shortIdOf(RECEIPT_ID), 'shortId');
  eq(parsed.crcOk, true, 'crcOk');
  eq(parsed.version, 1, 'version');
});

test('a single flipped bit fails the CRC', () => {
  const corrupted = (bits[0] === '0' ? '1' : '0') + bits.slice(1);
  eq(payload.parsePayload(corrupted).crcOk, false, 'crcOk');
});

test('parsePayload rejects a malformed payload', () => {
  let threw = false;
  try {
    payload.parsePayload('not-48-bits');
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('a malformed payload was accepted');
});

test('shortId fits in 36 bits', () => {
  const shortId = payload.shortIdOf(RECEIPT_ID);
  if (shortId > payload.SHORT_ID_MAX) throw new Error(`${shortId} exceeds 2^36 - 1`);
});

test('bitAgreement and bitsMatching agree with themselves', () => {
  eq(payload.bitAgreement(bits, bits), 1, 'agreement');
  eq(payload.bitsMatching(bits, bits), payload.PAYLOAD_BITS, 'matching');
});

test('bitAgreement drops as bits diverge', () => {
  const half = bits.slice(0, 24) + bits.slice(24).replace(/[01]/g, (c) => (c === '0' ? '1' : '0'));
  const agreement = payload.bitAgreement(bits, half);
  eq(agreement, 0.5, 'agreement');
});

// -------------------------------------------------- Hamming and BK-tree ----

test('hamming is a correct popcount', () => {
  eq(bktree.hamming(0n, 0n), 0, 'identical');
  eq(bktree.hamming(0n, 0xffffffffffffffffn), 64, 'opposite');
  eq(bktree.hamming(0b1011n, 0b1000n), 2, 'two differing bits');
});

test('BK-tree returns near neighbours and prunes far ones', () => {
  const tree = new bktree.BKTree('test');
  tree.insert(0b0000n, 1);
  tree.insert(0b0011n, 2); // distance 2 from the query
  tree.insert(0xffffffffffffffffn, 3); // distance 64 — must be pruned

  const ids = tree
    .search(0n, 4)
    .map((hit) => hit.id)
    .sort();
  eq(JSON.stringify(ids), JSON.stringify([1, 2]), 'matched ids');
});

test('BK-tree returns results sorted nearest first', () => {
  const tree = new bktree.BKTree('test');
  tree.insert(0b0111n, 1); // distance 3
  tree.insert(0b0001n, 2); // distance 1
  tree.insert(0b0011n, 3); // distance 2

  const order = tree.search(0n, 8).map((hit) => hit.id);
  eq(JSON.stringify(order), JSON.stringify([2, 3, 1]), 'order');
});

test('BK-tree keeps several events that share one hash', () => {
  const tree = new bktree.BKTree('test');
  tree.insert(0b1010n, 1);
  tree.insert(0b1010n, 2);
  eq(tree.search(0b1010n, 0).length, 2, 'hits');
});

test('searching an empty tree returns nothing', () => {
  eq(new bktree.BKTree('test').search(0n, 64).length, 0, 'hits');
});

// ---------------------------------------------------- Reed-Solomon ECC -----

const ecc = await import('../server/core/ecc.js');

test('rsEncode produces 96 bits from 48 bits', () => {
  const enc = ecc.rsEncode(bits);
  eq(enc.length, 96, 'rs encoded length');
});

test('rsDecode recovers from byte corruption in 96-bit RS codeword', () => {
  const enc = ecc.rsEncode(bits);
  // Corrupt 2 bytes in the encoded bits (e.g. flip bits in byte 1 and byte 7)
  const corrupted =
    enc.slice(0, 10) +
    (enc[10] === '0' ? '1' : '0') +
    enc.slice(11, 58) +
    (enc[58] === '0' ? '1' : '0') +
    enc.slice(59);

  const res = ecc.rsDecode(corrupted);
  eq(res.corrected, true, 'corrected flag');
  eq(res.bits, bits, 'recovered bits match original 48 bits');
});

test('rsDecode corrects single flipped bit in 48-bit extracted payload', () => {
  // corrupted 1 bit at index 0
  const singleFlip = (bits[0] === '0' ? '1' : '0') + bits.slice(1);
  const res = ecc.rsDecode(singleFlip);
  eq(res.corrected, true, 'corrected flag');
  eq(res.bits, bits, 'recovered bits');
});

// -------------------------------------------------- Post-Quantum Crypto -----

const pqc = await import('../server/core/pqc.js');

test('PQC keygen creates valid ML-KEM-768 and ML-DSA-65 key pairs', () => {
  const keys = pqc.generatePqcKeyPair();
  eq(keys.kemPublicKey.length, 1184, 'KEM pubkey len');
  eq(keys.dsaPublicKey.length, 1952, 'DSA pubkey len');
});

test('ML-KEM-768 encapsulate and decapsulate roundtrip matches shared secret', () => {
  const keys = pqc.generatePqcKeyPair();
  const enc = pqc.encapsulateKey(keys.kemPublicKey);
  eq(enc.cipherText.length, 1088, 'KEM ciphertext len');
  eq(enc.sharedSecret.length, 32, 'KEM shared secret len');
  const dec = pqc.decapsulateKey(enc.cipherText, keys.kemSecretKey);
  eq(Buffer.from(dec).equals(enc.sharedSecret), true, 'shared secret matches');
});

test('ML-DSA-65 signs and verifies receipt data successfully', () => {
  const keys = pqc.generatePqcKeyPair();
  const message = Buffer.from(
    'receipt:0x7f2c8b41e93ad6570c1f2b8e4a97d3510fbc62e8a4d17395c0e8b2f61a4d9037'
  );
  const sig = pqc.signDecryptionReceipt(keys.dsaSecretKey, message);
  eq(sig.length, 3309, 'DSA signature len');
  const valid = pqc.verifyDecryptionSignature(keys.dsaPublicKey, message, sig);
  eq(valid, true, 'DSA signature valid');
  const invalid = pqc.verifyDecryptionSignature(
    keys.dsaPublicKey,
    Buffer.from('tampered message'),
    sig
  );
  eq(invalid, false, 'tampered message rejected');
});

test('PQC key bundle encrypts and decrypts with recipient passphrase', () => {
  const keys = pqc.generatePqcKeyPair();
  const bundle = pqc.encryptKeyBundle(keys, 'secure-passphrase-123');
  const decrypted = pqc.decryptKeyBundle(bundle, 'secure-passphrase-123');
  eq(decrypted.kemSecretKey.equals(keys.kemSecretKey), true, 'KEM secret key matches');
  eq(decrypted.dsaSecretKey.equals(keys.dsaSecretKey), true, 'DSA secret key matches');
});

test('Complete PQC broadcast encryption and ML-DSA-65 non-repudiation pipeline', () => {
  const officerKeys = pqc.generatePqcKeyPair();
  const contentKey = nodeCrypto.randomBytes(32);

  // Sender encapsulates content key to officer's KEM public key
  const encap = pqc.encapsulateKey(officerKeys.kemPublicKey);
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', encap.sharedSecret, iv);
  const encKey = Buffer.concat([cipher.update(contentKey), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Recipient decapsulates
  const decSharedSecret = pqc.decapsulateKey(encap.ciphertext, officerKeys.kemSecretKey);
  const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', decSharedSecret, iv);
  decipher.setAuthTag(tag);
  const recoveredContentKey = Buffer.concat([decipher.update(encKey), decipher.final()]);
  eq(recoveredContentKey.equals(contentKey), true, 'content key recovered via ML-KEM-768');

  // Recipient signs receipt
  const receiptIdHex = '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
  const userRefHex = '0xaabbccddeeff11223344556677889900aabbccddeeff11223344556677889900';
  const receiptDigest = nodeCrypto
    .createHash('sha256')
    .update(
      Buffer.concat([
        Buffer.from(receiptIdHex.slice(2), 'hex'),
        Buffer.from(userRefHex.slice(2), 'hex'),
      ])
    )
    .digest();

  const signature = pqc.signDecryptionReceipt(receiptDigest, officerKeys.dsaSecretKey);
  const verified = pqc.verifyDecryptionSignature(
    signature,
    receiptDigest,
    officerKeys.dsaPublicKey
  );
  eq(verified, true, 'ML-DSA-65 signature verified on receipt digest');
});

// ---------------------------------------------------------------------------

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
