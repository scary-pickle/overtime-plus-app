import { encrypt, decrypt, isEncrypted } from '../lib/utils/encryption';

// In-memory mocks for SecureStore and crypto RNG
const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (len: number) => {
    // Deterministic bytes for tests
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = (i * 17) % 256;
    return arr;
  }),
}));

describe('encryption utility', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('encrypts and decrypts round-trip', async () => {
    const plaintext = 'hello noble v2';
    const ciphertext = await encrypt(plaintext);
    expect(ciphertext).not.toEqual(plaintext);
    expect(isEncrypted(ciphertext)).toBe(true);

    const decrypted = await decrypt(ciphertext);
    expect(decrypted).toEqual(plaintext);
  });

  it('is idempotent for empty input', async () => {
    expect(await encrypt('')).toEqual('');
    expect(await decrypt('')).toEqual('');
  });
});
