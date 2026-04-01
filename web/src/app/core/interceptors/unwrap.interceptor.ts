import { HttpInterceptorFn } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * Global interceptor that unwraps the backend's TransformInterceptor wrapper
 * `{ statusCode, data, timestamp }` so all services receive the inner `data` directly.
 */
export const unwrapInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event: any) => {
      if (event?.body && typeof event.body === 'object' && 'data' in event.body && 'statusCode' in event.body) {
        return event.clone({ body: event.body.data });
      }
      return event;
    })
  );
};
