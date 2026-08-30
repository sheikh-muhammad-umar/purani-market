import { UAParser } from 'ua-parser-js';

/**
 * Extraction of the client context behind a proxy, in one place.
 *
 * `x-forwarded-for` handling and user-agent parsing were previously
 * re-implemented at every tracking site, which meant the same event could be
 * attributed to the load balancer in one code path and the real client in
 * another. Everything that records who did something should read it from here.
 */

/** Longest client-supplied identifier we will store, to bound index size. */
const MAX_ID_LENGTH = 64;

export interface ClientContext {
  /** Originating client address, or undefined when it cannot be determined. */
  ip?: string;
  /** Raw user-agent string, kept verbatim for forensics. */
  userAgent?: string;
}

export interface DeviceContext {
  browser?: string;
  os?: string;
  /** Falls back to `desktop`, which is what analytics groups on. */
  deviceType: string;
  deviceVendor?: string;
  deviceModel?: string;
  engine?: string;
}

/**
 * Reads the true client address.
 *
 * `x-forwarded-for` accumulates hops left to right, so the first entry is the
 * original client. Falls back to the socket address for direct connections.
 */
export function clientIp(req: unknown): string | undefined {
  const request = req as
    | { headers?: Record<string, unknown>; ip?: string }
    | undefined;
  const forwarded = request?.headers?.['x-forwarded-for'];
  const first =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : Array.isArray(forwarded)
        ? String(forwarded[0] ?? '')
            .split(',')[0]
            ?.trim()
        : undefined;
  return first || request?.ip || undefined;
}

export function userAgentOf(req: unknown): string | undefined {
  const request = req as { headers?: Record<string, unknown> } | undefined;
  const ua = request?.headers?.['user-agent'];
  return typeof ua === 'string' && ua ? ua : undefined;
}

export function clientContext(req: unknown): ClientContext {
  return { ip: clientIp(req), userAgent: userAgentOf(req) };
}

/**
 * Derives device facts from a user-agent string.
 *
 * Keys are omitted rather than set to undefined so they do not occupy space in
 * the activity metadata map; `deviceType` is always present because the
 * engagement analytics group on it.
 */
export function deviceContext(userAgent: string | undefined): DeviceContext {
  const parser = new UAParser(userAgent || '');
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();
  const engine = parser.getEngine();

  const context: DeviceContext = { deviceType: device.type || 'desktop' };
  if (browser.name) {
    context.browser = `${browser.name} ${browser.version || ''}`.trim();
  }
  if (os.name) context.os = `${os.name} ${os.version || ''}`.trim();
  if (device.vendor) context.deviceVendor = device.vendor;
  if (device.model) context.deviceModel = device.model;
  if (engine.name) {
    context.engine = `${engine.name} ${engine.version || ''}`.trim();
  }
  return context;
}

/**
 * Trims a client-supplied id to something safe to index.
 *
 * Session and visitor ids arrive from the browser, so they are untrusted input
 * that lands in an indexed column; an unbounded string would let a caller bloat
 * the index at will.
 */
export function boundedId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, MAX_ID_LENGTH) : undefined;
}
