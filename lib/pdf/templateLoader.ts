import { Paths } from 'expo-file-system';
import { readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { supabaseEnabled, getSupabaseConfig } from '../supabase';
import { database } from '../db/sqlite';

// Feature flag: enable OTA template flow only when true
const OTA_ENABLED = process.env.EXPO_PUBLIC_TEMPLATE_OTA === 'true';

export type TemplateType = 'avac_normal' | 'avac_smo';

export interface TemplateMeta {
  templateType: TemplateType;
  version: string;
  pdfStoragePath: string;
  coordinateMapping: any; // normalized JSON object
}

function getCachePdfPath(templateType: TemplateType, version: string): string {
  const file = `${templateType}_${version}.pdf`;
  const base = Paths?.cache?.uri || 'cache';
  return base.endsWith('/') ? `${base}${file}` : `${base}/${file}`;
}

export function isTemplateOTAEnabled(): boolean {
  return OTA_ENABLED && supabaseEnabled;
}

// Fetch active template metadata from Supabase REST
export async function getLatestTemplateMeta(templateType: TemplateType): Promise<TemplateMeta | null> {
  if (!isTemplateOTAEnabled()) return null;
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  // Normalize localhost URLs for iOS simulator compatibility
  // iOS simulator can't reach localhost - need to use actual machine IP or 10.0.2.2 for Android
  let normalizedUrl = url.replace('127.0.0.1', 'localhost');
  
  // For iOS simulator, try using the machine's IP if localhost fails
  // This will be handled by a retry mechanism
  const endpoint = `${normalizedUrl}/rest/v1/pdf_templates?template_type=eq.${templateType}&is_active=is.true&select=template_type,version,pdf_storage_path,coordinate_mapping&limit=1`;
  
  console.log(`[templateLoader] Fetching template meta for ${templateType} from: ${endpoint.substring(0, 80)}...`);
  
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      console.error(`[templateLoader] Failed to fetch template meta: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    const row = Array.isArray(data) && data[0] ? data[0] : null;
    if (!row) return null;
    return {
      templateType,
      version: row.version,
      pdfStoragePath: row.pdf_storage_path,
      coordinateMapping: row.coordinate_mapping,
    };
  } catch (error) {
    console.error(`[templateLoader] Error fetching template meta for ${templateType}:`, error);
    return null;
  }
}

// Minimal storage downloader using existing storage utilities when possible
export async function downloadAndCachePDF(storagePath: string, templateType: TemplateType, version: string): Promise<string> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) throw new Error('Supabase not configured');

  // Try to get a public URL (assuming public bucket for local dev)
  // Normalize localhost URLs for iOS simulator compatibility
  const normalizedUrl = url.replace('127.0.0.1', 'localhost');
  const isHttp = storagePath.startsWith('http://') || storagePath.startsWith('https://');
  const fetchUrl = isHttp ? storagePath : `${normalizedUrl}/storage/v1/object/public/${storagePath}`;
  
  console.log(`[templateLoader] Downloading PDF from: ${fetchUrl}`);
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Failed to fetch template PDF: ${res.status}`);
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  if (arrayBuffer.byteLength < 10000) throw new Error('PDF too small');
  // Validate PDF header
  const header = new Uint8Array(arrayBuffer.slice(0, 5));
  if (!(header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46 && header[4] === 0x2D)) {
    throw new Error('Invalid PDF header');
  }

  // base64 encode and write to cache
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // @ts-ignore
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  const targetPath = getCachePdfPath(templateType, version);
  await writeAsStringAsync(targetPath, base64, { encoding: 'base64' });
  await database.setTemplateCache({ templateType, pdfPath: targetPath, version });
  await database.setTemplateVersion(templateType, version);
  return targetPath;
}

export async function ensureTemplateUpToDate(templateType: TemplateType): Promise<{
  pdfPath: string | null;
  mapping: any | null;
  version: string | null;
}> {
  if (!isTemplateOTAEnabled()) {
    return { pdfPath: null, mapping: null, version: null };
  }

  const meta = await getLatestTemplateMeta(templateType);
  const cached = await database.getTemplateCache(templateType);

  // Use cached if versions match
  if (meta && cached.version === meta.version && cached.pdfPath) {
    const mapping = cached.mappingJson ? JSON.parse(cached.mappingJson) : (meta.coordinateMapping || null);
    return { pdfPath: cached.pdfPath, mapping, version: cached.version };
  }

  // If meta exists and either not cached or version changed, download new PDF and cache mapping
  if (meta) {
    const pdfPath = await downloadAndCachePDF(meta.pdfStoragePath, templateType, meta.version);
    const mappingJson = JSON.stringify(meta.coordinateMapping || {});
    await database.setTemplateCache({
      templateType,
      mappingJson,
      version: meta.version,
    });
    return { pdfPath, mapping: meta.coordinateMapping || null, version: meta.version };
  }

  // If no meta available, return whatever cached exists
  return { pdfPath: cached.pdfPath, mapping: cached.mappingJson ? JSON.parse(cached.mappingJson) : null, version: cached.version };
}

export async function loadCachedPDFArrayBuffer(localPath: string): Promise<ArrayBuffer> {
  const base64 = await readAsStringAsync(localPath, { encoding: 'base64' });
  // @ts-ignore
  const binaryString = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}


