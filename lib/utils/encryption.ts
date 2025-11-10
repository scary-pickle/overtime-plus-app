/**
 * Field-level encryption utility for PII data
 * Uses a simple XOR-based cipher with keys stored in SecureStore
 * 
 * Note: This is a lightweight encryption solution suitable for protecting PII
 * in local storage. For production apps handling highly sensitive data,
 * consider using a more robust encryption library like crypto-js or expo-crypto.
 * 
 * This provides encryption for sensitive fields (initials, email) before storing in SQLite,
 * while keeping the encryption transparent to sync operations (Supabase receives unencrypted data).
 */

import * as SecureStore from 'expo-secure-store';
import base64 from 'react-native-base64';

const ENCRYPTION_KEY_STORE_KEY = 'pii_encryption_key';
const KEY_LENGTH = 32; // 256 bits

/**
 * Get or generate encryption key from SecureStore
 * Key is generated per-install and stored securely
 */
async function getEncryptionKey(): Promise<string> {
  try {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY);
    
    if (!key) {
      // Generate new key if it doesn't exist
      // Use a combination of random values and device info
      const randomPart1 = Math.random().toString(36).substring(2, 15);
      const randomPart2 = Math.random().toString(36).substring(2, 15);
      const randomPart3 = Math.random().toString(36).substring(2, 15);
      const randomPart4 = Math.random().toString(36).substring(2, 15);
      const combined = randomPart1 + randomPart2 + randomPart3 + randomPart4;
      
      // Pad to KEY_LENGTH
      const keyString = combined.padEnd(KEY_LENGTH, '0').substring(0, KEY_LENGTH);
      key = base64.encode(keyString);
      
      // Store the key securely
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_KEY, key);
    }
    
    return key;
  } catch (error) {
    console.error('[encryption] Failed to get encryption key:', error);
    throw new Error('Failed to access encryption key');
  }
}

/**
 * Simple XOR cipher for encryption/decryption
 * XOR is symmetric, so the same function works for both
 */
function xorCipher(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const textChar = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(textChar ^ keyChar);
  }
  return result;
}

/**
 * Encrypt a string value using XOR cipher
 * @param plaintext - The plaintext string to encrypt
 * @returns Base64-encoded encrypted string
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) {
    return plaintext; // Return empty string as-is
  }
  
  try {
    const keyBase64 = await getEncryptionKey();
    if (!keyBase64) {
      throw new Error('Encryption key not available');
    }
    const key = base64.decode(keyBase64);
    
    // Encrypt using XOR
    const encrypted = xorCipher(plaintext, key);
    
    // Encode to base64 for storage
    return base64.encode(encrypted);
  } catch (error) {
    console.error('[encryption] Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Check if a string looks like it's encrypted (valid base64)
 */
function isValidBase64(str: string): boolean {
  if (!str || str.length < 10) return false;
  try {
    // Try to decode as base64
    base64.decode(str);
    // Check if it contains only base64 characters
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return base64Regex.test(str);
  } catch {
    return false;
  }
}

/**
 * Decrypt a base64-encoded encrypted string
 * @param ciphertext - Base64-encoded encrypted string (or plaintext if old data)
 * @returns Decrypted plaintext string, or original string if not encrypted
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) {
    return ciphertext; // Return empty string as-is
  }
  
  // Check if this looks like encrypted data (valid base64)
  // If not, it's likely old unencrypted data - return as-is
  if (!isValidBase64(ciphertext)) {
    // Not encrypted (old data) - return as-is
    return ciphertext;
  }
  
  try {
    const keyBase64 = await getEncryptionKey();
    if (!keyBase64) {
      throw new Error('Encryption key not available');
    }
    const key = base64.decode(keyBase64);
    
    // Decode from base64
    const encrypted = base64.decode(ciphertext);
    
    // Decrypt using XOR (symmetric operation)
    return xorCipher(encrypted, key);
  } catch (error) {
    // If decryption fails, it might be corrupted encrypted data or old unencrypted data
    // Return original value to avoid breaking the app
    console.warn('[encryption] Decryption failed, returning original value (may be unencrypted old data):', error);
    return ciphertext;
  }
}

/**
 * Check if a string is encrypted (valid base64)
 * This is a simple heuristic
 */
export function isEncrypted(value: string): boolean {
  return isValidBase64(value);
}

