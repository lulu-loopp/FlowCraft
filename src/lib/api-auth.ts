import { readSettings } from '@/lib/settings-storage';

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

function normalizeHost(hostHeader: string | null): string {
  if (!hostHeader) return '';
  const trimmed = hostHeader.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    return end > 0 ? trimmed.slice(0, end + 1) : trimmed;
  }
  const idx = trimmed.indexOf(':');
  return idx >= 0 ? trimmed.slice(0, idx) : trimmed;
}

function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isLoopbackIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('127.') ||
    normalized.startsWith('::ffff:127.')
  );
}

function isLocalRequest(req: Request): boolean {
  const host = normalizeHost(req.headers.get('host'));
  if (LOCAL_HOSTS.has(host)) return true;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp && isLoopbackIp(firstIp)) return true;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp && isLoopbackIp(realIp)) return true;

  return false;
}

function readAuthToken(req: Request): string {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  const xToken = req.headers.get('x-flowcraft-token');
  return xToken?.trim() || '';
}

async function getConfiguredToken(): Promise<string> {
  const settings = await readSettings();
  const tokenFromSettings =
    typeof settings.apiToken === 'string' ? settings.apiToken.trim() : '';
  const tokenFromEnv = (process.env.FLOWCRAFT_API_TOKEN || '').trim();
  return tokenFromSettings || tokenFromEnv;
}

export async function requireMutationAuth(req: Request): Promise<Response | null> {
  const configuredToken = await getConfiguredToken();
  if (!configuredToken) {
    if (isLocalRequest(req)) return null;
    return Response.json(
      {
        error:
          'Unauthorized: configure FLOWCRAFT_API_TOKEN (or settings.apiToken) for non-local mutation/execute APIs.',
      },
      { status: 401 },
    );
  }

  const provided = readAuthToken(req);
  if (provided && provided === configuredToken) return null;
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
