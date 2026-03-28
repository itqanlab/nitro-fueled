/**
 * GLM connection test utilities.
 * Extracted from provider-config.ts to keep that file within the 200-line limit.
 */
import { isRecord } from './provider-config.js';

export interface GlmTestResult {
  ok: boolean;
  modelName?: string;
  error?: string;
}

/**
 * Resolve an API key value: if it starts with '$', read from the named env var.
 * Returns empty string if the env var is unset.
 */
export function resolveApiKey(value: string): string {
  if (value.startsWith('$')) {
    const envVarName = value.slice(1);
    return process.env[envVarName] ?? '';
  }
  return value;
}

/** Returns true for loopback, link-local, and RFC-1918 addresses (SSRF guard). */
function isPrivateOrLoopback(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (hostname === '::1' || hostname === '[::1]') return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127) return true;                          // 127.0.0.0/8 loopback
    if (a === 10) return true;                           // 10.0.0.0/8 RFC-1918
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12 RFC-1918
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16 RFC-1918
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local / cloud metadata
  }
  return false;
}

export async function testGlmConnection(apiKey: string, baseUrl: string): Promise<GlmTestResult> {
  const resolved = resolveApiKey(apiKey);
  if (resolved === '') return { ok: false, error: 'API key is empty' };

  let url: URL;
  try {
    url = new URL(`${baseUrl}/v1/models`);
  } catch {
    return { ok: false, error: 'Invalid base URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Base URL must use HTTPS' };
  }
  if (isPrivateOrLoopback(url.hostname)) {
    return { ok: false, error: 'Base URL must not target private or loopback addresses' };
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { 'x-api-key': resolved, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${String(response.status)} from provider` };
    }

    const data: unknown = await response.json();
    const models =
      isRecord(data) && Array.isArray(data['data']) ? data['data'] : [];
    const first = models[0];
    const modelName =
      isRecord(first) && typeof first['id'] === 'string' ? first['id'] : 'connected';
    return { ok: true, modelName };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
    return { ok: false, error: msg };
  }
}
