import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API_KEY_HEADER = 'X-API-Key';

export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add API key to requests going to our API
  if (req.url.includes(environment.apiUrl) || req.url.startsWith('/api')) {
    req = req.clone({
      setHeaders: { [API_KEY_HEADER]: environment.apiKey },
    });
  }
  return next(req);
};
