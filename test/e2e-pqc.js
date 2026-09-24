import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import { decrypt as aesDecrypt } from '../server/core/crypto.js';
import {
  decapsulateKey,
  signDecryptionReceipt,
  verifyDecryptionSignature,
  decryptKeyBundle,
} from '../server/core/pqc.js';
import { sha256 } from '../server/core/crypto.js';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Starting PQC End-to-End Test ---');

  // 1. Verify user PQC keys in database
  const officer = await prisma.user.findFirst({
    where: { email: 'u017@example.gov' },
  });
  if (!officer) throw new Error('Officer U-017 not found');
  if (!officer.kemPublicKey || !officer.dsaPublicKey || !officer.encryptedPqcKeys) {
    throw new Error('Officer U-017 is missing PQC keys');
  }
  console.log('✔ Officer PQC keys enrolled in DB:');
  console.log(`  KEM PubKey: ${officer.kemPublicKey.length} bytes`);
  console.log(`  DSA PubKey: ${officer.dsaPublicKey.length} bytes`);

  // 2. Unlock officer PQC private keys
  const keys = decryptKeyBundle(officer.encryptedPqcKeys, 'officer123');
  if (!keys.kemSecretKey || !keys.dsaSecretKey) {
    throw new Error('Failed to unlock PQC private keys');
  }
  console.log('✔ Officer PQC private keys unlocked with passphrase');

  // 3. Find asset and encapsulation
  const asset = await prisma.asset.findFirst({
    where: { title: 'Ops Order 44' },
  });
  if (!asset) throw new Error('Asset Ops Order 44 not found');

  const encap = await prisma.assetKeyEncapsulation.findUnique({
    where: { assetId_userId: { assetId: asset.id, userId: officer.id } },
  });
  if (!encap) throw new Error('Asset key encapsulation not found for officer');
  console.log(
    `✔ Found AssetKeyEncapsulation record (KEM Ciphertext: ${encap.kemCiphertext.length} bytes)`
  );

  // 4. Decapsulate content key using officer ML-KEM secret key
  const sharedSecret = decapsulateKey(encap.kemCiphertext, keys.kemSecretKey);
  const contentKey = aesDecrypt(
    encap.encryptedKey,
    sharedSecret,
    Buffer.from(encap.iv),
    Buffer.from(encap.authTag)
  );
  console.log(`✔ ML-KEM-768 decapsulation successful: 32-byte content key recovered`);

  // 5. Decrypt asset
  const ciphertext = await fs.readFile(asset.cipherPath);
  const plaintext = aesDecrypt(
    ciphertext,
    contentKey,
    Buffer.from(asset.iv),
    Buffer.from(asset.authTag)
  );
  console.log(`✔ Document decrypted: ${plaintext.length} bytes verified`);

  // 6. Sign decryption receipt with officer ML-DSA-65 secret key
  const receiptId = '0x99887766554433221100aabbccddeeff99887766554433221100aabbccddeeff';
  const receiptDigest = sha256(
    Buffer.concat([Buffer.from(receiptId.slice(2), 'hex'), Buffer.from(officer.userRef)])
  );

  const sig = signDecryptionReceipt(keys.dsaSecretKey, receiptDigest);
  console.log(`✔ ML-DSA-65 digital signature generated: ${sig.length} bytes`);

  // 7. Verify signature using officer ML-DSA-65 public key
  const verified = verifyDecryptionSignature(officer.dsaPublicKey, receiptDigest, sig);
  if (!verified) throw new Error('Signature verification failed');
  console.log('✔ ML-DSA-65 non-repudiation signature cryptographically VERIFIED!');

  console.log('\n--- All PQC End-to-End Checks Passed Perfectly! ---');
}

run()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
