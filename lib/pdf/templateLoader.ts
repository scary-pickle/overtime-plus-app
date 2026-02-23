import { readAsStringAsync } from 'expo-file-system/legacy';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('templateLoader');

export type TemplateType = 'avac_normal' | 'avac_smo';

export function isTemplateOTAEnabled(): boolean {
  return false;
}

export async function ensureTemplateUpToDate(_templateType: TemplateType): Promise<{
  pdfPath: string | null;
  mapping: any | null;
  version: string | null;
}> {
  debug.debug('OTA disabled; using bundled template');
  return { pdfPath: null, mapping: null, version: null };
}

export async function loadCachedPDFArrayBuffer(localPath: string): Promise<ArrayBuffer> {
  const base64 = await readAsStringAsync(localPath, { encoding: 'base64' });
  // @ts-ignore
  const binaryString = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}
