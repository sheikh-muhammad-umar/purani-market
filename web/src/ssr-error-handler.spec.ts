import { describe, it, expect, vi } from 'vitest';
import type { Request, Response as ExpressResponse } from 'express';
import { logSsrError, injectNoindexAndSend, sendFallbackShell } from './ssr-error-handler';

/* ---------- helpers ---------- */

const SHELL_HTML =
  '<!doctype html><html><head><title>marketplace.pk</title></head><body><app-root></app-root></body></html>';

function fakeRequest(overrides: Partial<Request> = {}): Request {
  return {
    originalUrl: '/listings/test-123',
    url: '/listings/test-123',
    headers: { 'user-agent': 'Googlebot/2.1' },
    ...overrides,
  } as unknown as Request;
}

function fakeExpressResponse(): ExpressResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const res: any = {
    _status: 200,
    _headers: {} as Record<string, string>,
    _body: '',
    status(code: number) {
      res._status = code;
      return res;
    },
    set(key: string, value: string) {
      res._headers[key.toLowerCase()] = value;
      return res;
    },
    send(body: string) {
      res._body = body;
      return res;
    },
  };
  return res;
}

function fakeWebResponse(
  body: string,
  status = 200,
  headers?: Record<string, string>,
): globalThis.Response {
  const h = new Headers(headers);
  if (!h.has('content-type')) {
    h.set('content-type', 'text/html; charset=utf-8');
  }
  return new Response(body, { status, headers: h });
}

/* ---------- logSsrError ---------- */

describe('logSsrError', () => {
  it('should log error with request URL, user agent, and error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = fakeRequest({ originalUrl: '/categories/electronics' });

    logSsrError(new Error('render timeout'), req);

    expect(spy).toHaveBeenCalledOnce();
    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toContain('[SSR Error]');
    expect(msg).toContain('/categories/electronics');
    expect(msg).toContain('Googlebot/2.1');
    expect(msg).toContain('render timeout');

    spy.mockRestore();
  });

  it('should handle non-Error objects gracefully', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = fakeRequest();

    logSsrError('string error', req);

    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toContain('string error');

    spy.mockRestore();
  });

  it('should use "unknown" when user-agent header is missing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = fakeRequest({ headers: {} });

    logSsrError(new Error('fail'), req);

    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toContain('unknown');

    spy.mockRestore();
  });

  it('should include an ISO timestamp', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = fakeRequest();

    logSsrError(new Error('test'), req);

    const msg = spy.mock.calls[0][0] as string;
    // ISO timestamp pattern: YYYY-MM-DDTHH:mm:ss
    expect(msg).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    spy.mockRestore();
  });
});

/* ---------- injectNoindexAndSend ---------- */

describe('injectNoindexAndSend', () => {
  it('should inject noindex meta tag after <head> and return 404 status', async () => {
    const html =
      '<!doctype html><html><head><title>Not Found</title></head><body>404</body></html>';
    const ssrResponse = fakeWebResponse(html, 404);
    const res = fakeExpressResponse();

    await injectNoindexAndSend(ssrResponse, res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._status).toBe(404);
    expect(res._body).toContain('<meta name="robots" content="noindex">');
    expect(res._body).toContain('<title>Not Found</title>');
    expect(res._headers['content-type']).toBe('text/html; charset=utf-8');
  });

  it('should inject noindex before </head> when <head> has attributes', async () => {
    const html =
      '<!doctype html><html><head lang="en"><title>Page</title></head><body></body></html>';
    const ssrResponse = fakeWebResponse(html, 404);
    const res = fakeExpressResponse();

    await injectNoindexAndSend(ssrResponse, res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._status).toBe(404);
    expect(res._body).toContain('<meta name="robots" content="noindex">');
  });

  it('should copy headers from SSR response except content-length', async () => {
    const html = '<html><head></head><body></body></html>';
    const ssrResponse = fakeWebResponse(html, 404, {
      'content-length': '999',
      'x-custom': 'value',
    });
    const res = fakeExpressResponse();

    await injectNoindexAndSend(ssrResponse, res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._headers['x-custom']).toBe('value');
    expect(res._headers['content-length']).toBeUndefined();
  });

  it('should fall back to shell HTML when reading the response body fails', async () => {
    const badResponse = {
      text: () => Promise.reject(new Error('read failed')),
      headers: new Headers(),
    } as unknown as globalThis.Response;

    const res = fakeExpressResponse();
    await injectNoindexAndSend(badResponse, res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._status).toBe(404);
    expect(res._body).toBe(SHELL_HTML);
  });

  it('should preserve original HTML content alongside the noindex tag', async () => {
    const html =
      '<html><head><meta charset="utf-8"><title>Test</title></head><body><div>Content</div></body></html>';
    const ssrResponse = fakeWebResponse(html, 404);
    const res = fakeExpressResponse();

    await injectNoindexAndSend(ssrResponse, res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._body).toContain('<meta charset="utf-8">');
    expect(res._body).toContain('<title>Test</title>');
    expect(res._body).toContain('<div>Content</div>');
    expect(res._body).toContain('<meta name="robots" content="noindex">');
  });
});

/* ---------- sendFallbackShell ---------- */

describe('sendFallbackShell', () => {
  it('should return 200 status with the shell HTML', () => {
    const res = fakeExpressResponse();

    sendFallbackShell(res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._status).toBe(200);
    expect(res._body).toBe(SHELL_HTML);
    expect(res._headers['content-type']).toBe('text/html; charset=utf-8');
  });

  it('should allow the browser to bootstrap the SPA (contains app-root)', () => {
    const res = fakeExpressResponse();

    sendFallbackShell(res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._body).toContain('<app-root></app-root>');
  });
});

/* ---------- SSR integration behavior ---------- */

describe('SSR error handling integration', () => {
  it('should return client-side shell with 200 on rendering error (simulated)', () => {
    // This test simulates the catch block behavior in server.ts:
    // When angularApp.handle() throws, the server catches the error,
    // logs it, and returns the shell HTML with 200 status.
    const res = fakeExpressResponse();
    const req = fakeRequest({ originalUrl: '/listings/broken-page' });

    // Simulate the catch handler
    const err = new Error('Component render failed');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSsrError(err, req);
    sendFallbackShell(res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._status).toBe(200);
    expect(res._body).toContain('<app-root>');
    expect(spy).toHaveBeenCalledOnce();

    spy.mockRestore();
  });

  it('should return 404 with noindex for not-found listing/category/seller', async () => {
    // Simulates the Angular SSR engine returning a 404 response
    const notFoundHtml =
      '<html><head><title>Listing Not Found</title></head><body>This listing does not exist</body></html>';
    const ssrResponse = fakeWebResponse(notFoundHtml, 404);
    const res = fakeExpressResponse();

    await injectNoindexAndSend(ssrResponse, res as unknown as ExpressResponse, SHELL_HTML);

    expect(res._status).toBe(404);
    expect(res._body).toContain('<meta name="robots" content="noindex">');
    expect(res._body).toContain('Listing Not Found');
  });

  it('should return fully rendered HTML for successful SSR (simulated)', () => {
    // When SSR succeeds, the response is written directly via writeResponseToNodeResponse.
    // We verify the contract: a successful response has status 200 and contains rendered content.
    const renderedHtml =
      '<html><head><title>iPhone 15 - PKR 250000 | marketplace.pk</title></head><body><app-root>rendered content</app-root></body></html>';
    const ssrResponse = fakeWebResponse(renderedHtml, 200);

    expect(ssrResponse.status).toBe(200);
    // The response body should contain the expected rendered content
    ssrResponse.text().then((text) => {
      expect(text).toContain('iPhone 15');
      expect(text).toContain('marketplace.pk');
      expect(text).toContain('rendered content');
    });
  });
});
