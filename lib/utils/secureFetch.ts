/**
 * Runtime guard to block non-HTTPS endpoints (except localhost/dev allowances).
 * Wraps global fetch to enforce:
 *  - HTTPS only
 *  - Allow file:// and data: for local assets
 *  - Allow http://localhost/127/0.0.0.0/10.x/192.168.x for dev if env flag permits
 */

const allowLocalHttp = process.env.EXPO_PUBLIC_ALLOW_HTTP_IN_DEV === 'true';

function isDevHost(url: URL): boolean {
  const host = url.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.')
  );
}

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.toString?.() || '';
    if (urlString.startsWith('file://') || urlString.startsWith('data:')) {
      return originalFetch(input as any, init);
    }

    const parsed = new URL(urlString);

    if (parsed.protocol === 'https:') {
      return originalFetch(input as any, init);
    }

    if (parsed.protocol === 'http:' && allowLocalHttp && isDevHost(parsed)) {
      return originalFetch(input as any, init);
    }

    throw new Error(`Blocked insecure request to non-HTTPS endpoint: ${parsed.origin}`);
  } catch (error) {
    // If parsing fails (unlikely), fail closed to avoid leaking requests
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Blocked insecure request');
  }
};
