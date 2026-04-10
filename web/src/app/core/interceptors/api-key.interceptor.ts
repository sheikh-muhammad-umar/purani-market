import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add API key to requests going to our API
  if (req.url.includes(environment.apiUrl) || req.url.startsWith('/api')) {
    req = req.clone({
      setHeaders: { 'X-API-Key': environment.apiKey },
    });
  }
  return next(req);
};
