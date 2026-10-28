import { PairingConfig, PairingParseResult } from '../../models/EdgeModels';

function trimTrailingSlashes(value: string): string {
  let result: string = value;
  while (result.length > 0 && result.charAt(result.length - 1) === '/') {
    result = result.substring(0, result.length - 1);
  }
  return result;
}

export function normalizeServiceUrl(value: string): string | undefined {
  const trimmed: string = value.trim();
  if (trimmed.length === 0 || trimmed.indexOf(' ') >= 0) {
    return undefined;
  }
  const lower: string = trimmed.toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return undefined;
  }
  const schemeEnd: number = lower.indexOf('://');
  if (schemeEnd < 0 || trimmed.length <= schemeEnd + 3) {
    return undefined;
  }
  const authority: string = trimmed.substring(schemeEnd + 3).split('/')[0];
  if (authority.length === 0 || authority.indexOf(':') === 0) {
    return undefined;
  }
  return trimTrailingSlashes(trimmed);
}

function parseExpiry(value: Object | undefined, isMilliseconds: boolean): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  if (!isMilliseconds && value < 100000000000) {
    return value * 1000;
  }
  return value;
}

function parseJsonPayload(raw: string, nowMs: number): PairingParseResult {
  try {
    const parsed: Record<string, Object> = JSON.parse(raw) as Record<string, Object>;
    const urlValue: Object | undefined = parsed['service_url'] ?? parsed['url'];
    const serviceUrl: string | undefined = typeof urlValue === 'string' ? normalizeServiceUrl(urlValue) : undefined;
    if (serviceUrl === undefined) {
      return { error: 'service_url_invalid' };
    }

    const tokenValue: Object | undefined = parsed['token'];
    const token: string | undefined = typeof tokenValue === 'string' && tokenValue.trim().length > 0
      ? tokenValue.trim()
      : undefined;
    const hasMillisecondsExpiry: boolean = parsed['expires_at_ms'] !== undefined;
    const expiryValue: Object | undefined = hasMillisecondsExpiry ? parsed['expires_at_ms'] : parsed['expires_at'];
    const expiresAtMs: number | undefined = parseExpiry(expiryValue, hasMillisecondsExpiry);
    if (token !== undefined && (expiresAtMs === undefined || !isTokenUsable(token, expiresAtMs, nowMs))) {
      return { error: 'token_expired_or_expiry_missing' };
    }
    return { serviceUrl, token, expiresAtMs };
  } catch (_) {
    return { error: 'pairing_payload_invalid' };
  }
}

export function isTokenUsable(token: string | undefined, expiresAtMs: number | undefined, nowMs: number = Date.now()): boolean {
  return token !== undefined && token.trim().length > 0 && expiresAtMs !== undefined && expiresAtMs > nowMs;
}

export function parsePairingPayload(payload: string, nowMs: number = Date.now()): PairingParseResult {
  const raw: string = payload.trim();
  if (raw.length === 0) {
    return { error: 'pairing_payload_empty' };
  }
  if (raw.charAt(0) === '{') {
    return parseJsonPayload(raw, nowMs);
  }
  const serviceUrl: string | undefined = normalizeServiceUrl(raw);
  if (serviceUrl === undefined) {
    return { error: 'service_url_invalid' };
  }
  return { serviceUrl };
}

export function toPairingConfig(result: PairingParseResult): PairingConfig | undefined {
  if (result.serviceUrl === undefined || result.error !== undefined) {
    return undefined;
  }
  return {
    serviceUrl: result.serviceUrl,
    token: result.token,
    expiresAtMs: result.expiresAtMs
  };
}
