import {
  isPlatformBrowser as _isPlatformBrowser,
  isPlatformServer as _isPlatformServer,
} from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

/**
 * Returns `true` when running in a browser environment.
 * Must be called within an Angular injection context (constructor, field initializer, or `runInInjectionContext`).
 */
export function isPlatformBrowser(): boolean {
  return _isPlatformBrowser(inject(PLATFORM_ID));
}

/**
 * Returns `true` when running on the server (SSR).
 * Must be called within an Angular injection context (constructor, field initializer, or `runInInjectionContext`).
 */
export function isPlatformServer(): boolean {
  return _isPlatformServer(inject(PLATFORM_ID));
}
