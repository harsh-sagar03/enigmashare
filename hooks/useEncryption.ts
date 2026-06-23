import { useCallback } from 'react';

async function getKeyMaterial(keyBase64: string): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

export function useEncryption() {
  const generateKey = useCallback(async (): Promise<string> => {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const raw = await crypto.subtle.exportKey('raw', key);
    const bytes = new Uint8Array(raw);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  const encryptBlob = useCallback(async (
    blob: Blob,
    keyBase64: string
  ): Promise<Blob> => {
    const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = await blob.arrayBuffer();

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );

    // Concatenate IV + ciphertext into a single blob
    const result = new Uint8Array(iv.length + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), iv.length);

    return new Blob([result], { type: 'application/octet-stream' });
  }, []);

  const decryptBlob = useCallback(async (
    encryptedBlob: Blob,
    keyBase64: string
  ): Promise<Blob> => {
    const key = await getKeyMaterial(keyBase64);
    const encryptedData = await encryptedBlob.arrayBuffer();
    const data = new Uint8Array(encryptedData);

    // Extract IV (first 12 bytes) and ciphertext (remaining)
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new Blob([decrypted]);
  }, []);

  return { generateKey, encryptBlob, decryptBlob };
}