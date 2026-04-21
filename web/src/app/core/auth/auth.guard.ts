import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, catchError, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

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

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  return true;
};
