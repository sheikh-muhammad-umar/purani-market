import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, Subject, filter, take } from 'rxjs';
import { AuthService, AuthTokens } from './auth.service';

let isRefreshing = false;
let refreshResult$ = new Subject<AuthTokens | null>();

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 401 &&
        token &&
        !req.url.includes('/auth/refresh-token') &&
        !req.url.includes('/auth/login')
      ) {
        // If already refreshing, wait for the result
        if (isRefreshing) {
          return refreshResult$.pipe(
            filter((result): result is AuthTokens | null => true),
            take(1),
            switchMap((tokens) => {
              if (tokens) {
                const cloned = req.clone({
                  setHeaders: { Authorization: `Bearer ${tokens.accessToken}` },
                });
                return next(cloned);
              }
              return throwError(() => error);
            }),
          );
        }

        isRefreshing = true;
        refreshResult$ = new Subject<AuthTokens | null>();

        return authService.refreshToken().pipe(
          switchMap((tokens) => {
            authService.storeTokens(tokens);
            isRefreshing = false;
            refreshResult$.next(tokens);
            refreshResult$.complete();
            const cloned = req.clone({
              setHeaders: { Authorization: `Bearer ${tokens.accessToken}` },
            });
            return next(cloned);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            refreshResult$.next(null);
            refreshResult$.complete();
            authService.clearTokens();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
