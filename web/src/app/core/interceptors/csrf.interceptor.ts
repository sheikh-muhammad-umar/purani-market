import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = '_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** In-memory store for the latest CSRF token received from the backend. */
let csrfToken: string | null = null;

/**
 * Reads the CSRF token from either:
 *  1. The `x-csrf-token` response header (works cross-origin in dev), or
 *  2. The `_csrf` cookie (works same-origin in production).
 *
 * Attaches the token as an `X-CSRF-Token` request header on every
 * state-changing request (POST, PUT, PATCH, DELETE).
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  if (!isBrowser) {
    return next(req);
  }

  const isOurApi = req.url.includes(environment.apiUrl) || req.url.startsWith('/api');

  // Attach token on state-changing requests to our API
  if (!SAFE_METHODS.has(req.method) && isOurApi) {
    const token = csrfToken || getCookie(CSRF_COOKIE);
    if (token) {
      req = req.clone({
        setHeaders: { [CSRF_HEADER]: token },
      });
    }
  }

  // Capture the CSRF token from any response header
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && isOurApi) {
        const headerToken = event.headers.get(CSRF_HEADER);
        if (headerToken) {
          csrfToken = headerToken;
        }
      }
    }),
  );
};

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
