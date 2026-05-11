import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth';
import { unwrapInterceptor } from './core/interceptors/unwrap.interceptor';
import { apiKeyInterceptor } from './core/interceptors/api-key.interceptor';
import { csrfInterceptor } from './core/interceptors/csrf.interceptor';
import { emailVerificationInterceptor } from './core/interceptors/email-verification.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([
        apiKeyInterceptor,
        csrfInterceptor,
        jwtInterceptor,
        unwrapInterceptor,
        emailVerificationInterceptor,
      ]),
    ),
    provideClientHydration(withHttpTransferCacheOptions({})),
  ],
};
