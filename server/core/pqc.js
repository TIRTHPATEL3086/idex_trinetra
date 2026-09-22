/**
 * ============================================================================
 * Post-Quantum Cryptography (PQC) Module
 * NIST FIPS 203 (ML-KEM-768) & NIST FIPS 204 (ML-DSA-65)
 * ============================================================================
 *
 * Implements quantum-safe Key Encapsulation (ML-KEM-768 / CRYSTALS-Kyber) for
 * per-recipient content key exchange and quantum-safe Digital Signatures
 * (ML-DSA-65 / CRYSTALS-Dilithium) for non-repudiation binding on receipts.
 *
 * Built on @noble/post-quantum (pure JS, zero native build tools, fully offline/air-gap).
 */

import crypto from 'node:crypto';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { encrypt, decrypt, deriveKey } from './crypto.js';

export const PQC_ALGORITHMS = {
  kem: 'ML-KEM-768 (NIST FIPS 203)',
  dsa: 'ML-DSA-65 (NIST FIPS 204)',
};

/**
 * Generate a complete PQC key bundle for a user.
 * Returns both public keys (for DB) and secret keys (for recipient).
 */
export function generatePqcKeyPair() {
  const kem = ml_kem768.keygen();
  const dsa = ml_dsa65.keygen();

  return {
    kemPublicKey: Buffer.from(kem.publicKey),
    kemSecretKey: Buffer.from(kem.secretKey),
    dsaPublicKey: Buffer.from(dsa.publicKey),
    dsaSecretKey: Buffer.from(dsa.secretKey),
  };
}

/**
 * Encapsulate a shared secret to a recipient's ML-KEM-768 public key.
 * @param {Buffer|Uint8Array} kemPublicKey 1184 bytes
 * @returns {{ cipherText: Buffer, sharedSecret: Buffer }}
 */
export function encapsulateKey(kemPublicKey) {
  const pub = new Uint8Array(kemPublicKey);
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(pub);
  const buf = Buffer.from(cipherText);
  return {
    cipherText: buf,
    ciphertext: buf,
    sharedSecret: Buffer.from(sharedSecret),
  };
}

/**
 * Decapsulate shared secret using the recipient's ML-KEM-768 secret key.
 * @param {Buffer|Uint8Array} cipherText 1088 bytes
 * @param {Buffer|Uint8Array} kemSecretKey 2400 bytes
 * @returns {Buffer} 32-byte shared secret
 */
export function decapsulateKey(cipherText, kemSecretKey) {
  const ct = new Uint8Array(cipherText);
  const sk = new Uint8Array(kemSecretKey);
  const sharedSecret = ml_kem768.decapsulate(ct, sk);
  return Buffer.from(sharedSecret);
}

/**
 * Sign a message using ML-DSA-65 private key (non-repudiation).
 * Accepts either (dsaSecretKey, message) or (message, dsaSecretKey).
 * @param {Buffer|Uint8Array} dsaSecretKey 4032 bytes
 * @param {Buffer|string} message Data to sign (receipt digest)
 * @returns {Buffer} 3309-byte ML-DSA-65 signature
 */
export function signDecryptionReceipt(arg1, arg2) {
  let skBytes, msgBytes;
  if ((arg1?.length || 0) === 4032) {
    skBytes = arg1;
    msgBytes = arg2;
  } else if ((arg2?.length || 0) === 4032) {
    skBytes = arg2;
    msgBytes = arg1;
  } else {
    // Default fallback
    skBytes = arg1;
    msgBytes = arg2;
  }

  const sk = new Uint8Array(skBytes);
  const msgBuf = Buffer.isBuffer(msgBytes) ? msgBytes : Buffer.from(msgBytes);
  const msg = new Uint8Array(msgBuf);
  const sig = ml_dsa65.sign(msg, sk);
  return Buffer.from(sig);
}

/**
 * Verify an ML-DSA-65 signature against the recipient's public key.
 * Accepts any permutation of (publicKey, message, signature) or (signature, message, publicKey).
 * @param {Buffer|Uint8Array} dsaPublicKey 1952 bytes
 * @param {Buffer|string} message
 * @param {Buffer|Uint8Array} signature 3309 bytes
 * @returns {boolean}
 */
export function verifyDecryptionSignature(a, b, c) {
  try {
    const args = [a, b, c];
    // Signature is 3309 bytes
    const sigArg = args.find((x) => (x?.length || 0) === 3309);
    // Public key is 1952 bytes
    const pkArg = args.find((x) => (x?.length || 0) === 1952);
    // Message is the remaining argument
    const msgArg = args.find((x) => x !== sigArg && x !== pkArg);

    if (!sigArg || !pkArg || !msgArg) return false;

    const pk = new Uint8Array(pkArg);
    const msgBuf = Buffer.isBuffer(msgArg) ? msgArg : Buffer.from(msgArg);
    const msg = new Uint8Array(msgBuf);
    const sig = new Uint8Array(sigArg);

    return ml_dsa65.verify(sig, msg, pk);
  } catch {
    return false;
  }
}

/**
 * Encrypt a user's private key bundle with their passphrase using scrypt + AES-256-GCM.
 * Safe to store in DB or export as backup.
 */
export function encryptKeyBundle({ kemSecretKey, dsaSecretKey }, passphrase) {
  const salt = crypto.randomBytes(16);
  const derivedKey = deriveKey(passphrase, salt);
  const payload = Buffer.from(
    JSON.stringify({
      kemSecretKey: Buffer.from(kemSecretKey).toString('base64'),
      dsaSecretKey: Buffer.from(dsaSecretKey).toString('base64'),
    })
  );

  const { ciphertext, iv, authTag } = encrypt(payload, derivedKey);

  return JSON.stringify({
    version: 'pqc-v1',
    algorithms: PQC_ALGORITHMS,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('base64'),
  });
}

/**
 * Decrypt a user's private key bundle using their passphrase.
 * @returns {{ kemSecretKey: Buffer, dsaSecretKey: Buffer }}
 */
export function decryptKeyBundle(bundleJson, passphrase) {
  const parsed = typeof bundleJson === 'string' ? JSON.parse(bundleJson) : bundleJson;
  const salt = Buffer.from(parsed.salt, 'hex');
  const iv = Buffer.from(parsed.iv, 'hex');
  const authTag = Buffer.from(parsed.authTag, 'hex');
  const ciphertext = Buffer.from(parsed.ciphertext, 'base64');

  const derivedKey = deriveKey(passphrase, salt);
  const plaintext = decrypt(ciphertext, derivedKey, iv, authTag);
  const data = JSON.parse(plaintext.toString('utf8'));

  return {
    kemSecretKey: Buffer.from(data.kemSecretKey, 'base64'),
    dsaSecretKey: Buffer.from(data.dsaSecretKey, 'base64'),
  };
}
