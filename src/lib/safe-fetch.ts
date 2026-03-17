import dns from 'dns/promises';
import net from 'net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;

  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('::ffff:127.')
  );
}

function isBlockedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true;
}

async function assertSafeHostname(hostname: string): Promise<void> {
  const lowered = hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.has(lowered) ||
    lowered.endsWith('.localhost') ||
    lowered.endsWith('.local') ||
    lowered.endsWith('.internal')
  ) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  const literalVersion = net.isIP(lowered);
  if (literalVersion) {
    if (isBlockedIp(lowered)) throw new Error(`Blocked target IP: ${hostname}`);
    return;
  }

  const resolved = await dns.lookup(lowered, { all: true, verbatim: true });
  if (!resolved.length) throw new Error(`Host cannot be resolved: ${hostname}`);

  for (const entry of resolved) {
    if (isBlockedIp(entry.address)) {
      throw new Error(`Blocked resolved IP: ${entry.address}`);
    }
  }
}

export async function assertSafeFetchUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new Error('Credentialed URL is not allowed');
  }

  await assertSafeHostname(url.hostname);
  return url;
}

export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  const maxRedirects = 3;
  let current = rawUrl;

  for (let i = 0; i <= maxRedirects; i += 1) {
    const safeUrl = await assertSafeFetchUrl(current);
    const res = await fetch(safeUrl.toString(), { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      current = new URL(location, safeUrl).toString();
      continue;
    }
    return res;
  }

  throw new Error('Too many redirects');
}

