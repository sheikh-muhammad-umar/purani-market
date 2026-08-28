import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
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
      // Native View Transitions: cross-fades route changes instead of the
      // content snapping. Browsers without the API simply navigate as before,
      // and styles.scss opts out under prefers-reduced-motion.
      withViewTransitions({ skipInitialTransition: true }),
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
