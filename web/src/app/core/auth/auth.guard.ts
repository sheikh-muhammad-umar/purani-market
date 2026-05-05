import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, catchError, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // On SSR, allow navigation — client will re-evaluate
  if (!isBrowser) return true;

  if (authService.isAuthenticated()) {
    return true;
  }

  // Token exists but user not loaded yet (e.g. page refresh) — verify by fetching user
  if (authService.getAccessToken()) {
    return authService.fetchCurrentUser().pipe(
      map(() => true),
      catchError(() => of(router.createUrlTree(['/auth/login']))),
    );
  }

  return router.createUrlTree(['/auth/login']);
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  if (!isBrowser) return true;

  // Already loaded and is admin
  if (authService.isAdmin()) {
    return true;
  }

  // Has token but user not fetched yet — fetch and check
  if (authService.getAccessToken() && !authService.user()) {
    return authService.fetchCurrentUser().pipe(
      map(() => (authService.isAdmin() ? true : router.createUrlTree(['/']))),
      catchError(() => of(router.createUrlTree(['/auth/login']))),
    );
  }

  return router.createUrlTree(['/']);
};

export const sellerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  if (!isBrowser) return true;

  if (authService.isAuthenticated()) {
    return true;
  }

  if (authService.getAccessToken()) {
    return authService.fetchCurrentUser().pipe(
      map(() => true),
      catchError(() => of(router.createUrlTree(['/auth/login']))),
    );
  }

  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  if (!isBrowser) return true;

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  return true;
};
