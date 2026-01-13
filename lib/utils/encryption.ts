/**
 * Field-level encryption utility for PII data
 * Uses XChaCha20-Poly1305 (AEAD) with per-install keys stored in SecureStore.
 * Includes backwards-compatible decryption for legacy XOR-encrypted values.
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import base64 from 'react-native-base64';
import { createScopedLogger } from './logger';

const debug = createScopedLogger('encryption');

const ENCRYPTION_KEY_STORE_KEY = 'pii_encryption_key';
const KEY_LENGTH = 32; // bytes
const NONCE_LENGTH = 24; // XChaCha20-Poly1305 nonce
const NEW_SCHEME_PREFIX = 'v2:'; // Marker for authenticated encryption payloads

// --- Helpers: base64 <-> Uint8Array ---
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64.encode(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = base64.decode(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Key management ---
async function getEncryptionKeyBytes(): Promise<Uint8Array> {
  try {
    let stored = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY);

    // Legacy keys were stored as base64 of a random string; new keys are random bytes base64.
    if (stored) {
      try {
        return base64ToBytes(stored);
      } catch {
        // Fall back to UTF-8 bytes for legacy plain strings
        return new TextEncoder().encode(stored);
      }
    }

    // Generate new 256-bit key and store as base64
    const keyBytes = await getRandomBytesAsync(KEY_LENGTH);
    const b64 = bytesToBase64(keyBytes);
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_KEY, b64);
    return keyBytes;
  } catch (error) {
    debug.error('Failed to get encryption key:', error);
    throw new Error('Failed to access encryption key');
  }
}

// --- Legacy XOR fallback (for migration on read) ---
function legacyXorCipher(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const textChar = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(textChar ^ keyChar);
  }
  return result;
}

function tryLegacyDecrypt(value: string, key: string): string | null {
  try {
    // Legacy payload was base64 of XOR(ciphertext)
    const decoded = base64.decode(value);
    return legacyXorCipher(decoded, key);
  } catch {
    return null;
  }
}

// --- Authenticated encryption (current) ---
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) {
    return plaintext;
  }

  try {
    const key = await getEncryptionKeyBytes();
    const nonce = await getRandomBytesAsync(NONCE_LENGTH);
    const cipher = xchacha20poly1305(key, nonce);
    const ciphertext = cipher.encrypt(new TextEncoder().encode(plaintext));

    const payload = new Uint8Array(nonce.length + ciphertext.length);
    payload.set(nonce, 0);
    payload.set(ciphertext, nonce.length);

    return `${NEW_SCHEME_PREFIX}${bytesToBase64(payload)}`;
  } catch (error) {
    debug.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) {
    return ciphertext;
  }

  // New scheme marker
    if (ciphertext.startsWith(NEW_SCHEME_PREFIX)) {
      try {
        const key = await getEncryptionKeyBytes();
        const payload = base64ToBytes(ciphertext.slice(NEW_SCHEME_PREFIX.length));
        if (payload.length <= NONCE_LENGTH) {
        throw new Error('Invalid payload length');
      }
      const nonce = payload.slice(0, NONCE_LENGTH);
      const body = payload.slice(NONCE_LENGTH);
      const cipher = xchacha20poly1305(key, nonce);
      const plaintextBytes = cipher.decrypt(body);
      return new TextDecoder().decode(plaintextBytes);
    } catch (error) {
      debug.warn('Failed to decrypt authenticated payload, returning original:', error);
      return ciphertext;
    }
  }

  // Legacy XOR fallback (best-effort)
  try {
    const legacyKeyB64 = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY);
    if (legacyKeyB64) {
      const legacyKey = base64.decode(legacyKeyB64);
      const legacy = tryLegacyDecrypt(ciphertext, legacyKey);
      if (legacy !== null) {
        return legacy;
      }
    }
  } catch (legacyError) {
    debug.warn('Legacy decryption failed:', legacyError);
  }

  // Not encrypted or unreadable; return as-is to avoid data loss
  return ciphertext;
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(NEW_SCHEME_PREFIX);
}
