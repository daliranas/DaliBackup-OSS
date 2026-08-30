import path from 'path';
import fs from 'fs';

// Setup temporary DB for tests
const TEST_DB_FILE = path.join(process.cwd(), 'data/test_crypto_vault.db');
const dataDir = path.dirname(TEST_DB_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (fs.existsSync(TEST_DB_FILE)) fs.unlinkSync(TEST_DB_FILE);

process.env.DATABASE_FILE = TEST_DB_FILE;
process.env.DB_PATH = TEST_DB_FILE;
// Ensure no environment key interferes with testing the DB key logic
delete process.env.ENCRYPTION_KEY;

import assert from 'assert';
import { db, initDatabase } from '../src/config/database';
import { encryptSecret, decryptSecret } from '../src/utils/cryptoVault';

async function runCryptoVaultTests() {
  console.log('🧪 Démarrage des tests unitaires pour CryptoVault...\n');
  initDatabase();

  // Test 1: null/undefined
  console.log('1. Test encryptSecret/decryptSecret avec null/undefined');
  assert.strictEqual(encryptSecret(null), null);
  assert.strictEqual(encryptSecret(undefined), null);
  assert.strictEqual(decryptSecret(null), null);
  assert.strictEqual(decryptSecret(undefined), null);

  // Test 2: Normal encryption / decryption
  console.log('2. Test chiffrement/déchiffrement normal');
  const plainText = 'super-secret-123!@#';
  const encrypted = encryptSecret(plainText);
  assert(encrypted !== null && encrypted.includes(':'));
  const parts = encrypted!.split(':');
  assert.strictEqual(parts.length, 3);

  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, plainText);

  // Test 3: Tampered payload
  console.log('3. Test échec de déchiffrement sur données corrompues');
  const [iv, tag, data] = encrypted!.split(':');

  // Tamper with data
  const tamperedData = Buffer.from(data, 'hex');
  tamperedData[0] = tamperedData[0] ^ 1;
  const tamperedEncrypted = `${iv}:${tag}:${tamperedData.toString('hex')}`;

  assert.throws(() => {
    decryptSecret(tamperedEncrypted);
  }, /Échec du déchiffrement/);

  // Tamper with tag
  const tamperedTag = Buffer.from(tag, 'hex');
  tamperedTag[0] = tamperedTag[0] ^ 1;
  const tamperedTagEncrypted = `${iv}:${tamperedTag.toString('hex')}:${data}`;
  assert.throws(() => {
    decryptSecret(tamperedTagEncrypted);
  }, /Échec du déchiffrement/);

  // Clean up
  try {
    if (typeof (db as any).close === 'function') {
      (db as any).close();
    }
  } catch {}
  if (fs.existsSync(TEST_DB_FILE)) fs.unlinkSync(TEST_DB_FILE);

  console.log('\n🎉 TOUS LES TESTS DE CRYPTOVAULT SONT PASSÉS !');
}

runCryptoVaultTests().catch(err => {
  console.error('❌ Échec des tests CryptoVault:', err);
  process.exit(1);
});
