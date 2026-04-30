import type { Request, Response as ExpressResponse } from 'express';

const NOINDEX_TAG = '<meta name="robots" content="noindex">';

/**
 * Log an SSR error with request context for debugging.
 */
export function logSsrError(err: unknown, req: Request): void {
  const timestamp = new Date().toISOString();
  const url = req.originalUrl || req.url;
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  console.error(
    `[SSR Error] ${timestamp} | URL: ${url} | UA: ${userAgent} | ${err instanceof Error ? err.message : String(err)}`,
  );
}

/**
 * Read the SSR response body, inject a `<meta name="robots" content="noindex">`
 * tag into the `<head>`, and send it with a 404 status code.
 *
 * @param ssrResponse - The Web standard Response from the Angular SSR engine.
 * @param res - The Express response to write to.
 * @param fallbackHtml - HTML to send if reading the SSR response fails.
 */
export async function injectNoindexAndSend(
  ssrResponse: globalThis.Response,
  res: ExpressResponse,
  fallbackHtml: string,
): Promise<void> {
  try {
    let html = await ssrResponse.text();

    // Inject noindex meta tag right after <head> or before </head>
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${NOINDEX_TAG}`);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `${NOINDEX_TAG}</head>`);
    }

    // Copy headers from the SSR response (skip content-length since we modified the body)
    ssrResponse.headers.forEach((value: string, key: string) => {
      if (key.toLowerCase() !== 'content-length') {
        res.set(key, value);
      }
    });

    res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch {
    // If anything goes wrong reading the response, send the fallback with 404
    res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(fallbackHtml);
  }
}

/**
 * Send the client-side shell HTML as a fallback when SSR rendering fails.
 * Returns 200 so the browser can bootstrap the SPA normally.
 */
export function sendFallbackShell(res: ExpressResponse, shellHtml: string): void {
  res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(shellHtml);
}
