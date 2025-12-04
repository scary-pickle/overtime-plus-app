declare module '@noble/ciphers/chacha' {
  export function xchacha20poly1305(key: Uint8Array, nonce: Uint8Array): {
    encrypt(plaintext: Uint8Array): Uint8Array;
    decrypt(ciphertext: Uint8Array): Uint8Array;
  };
}

