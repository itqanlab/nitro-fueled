import { HttpInterceptorFn } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * Unwraps the API response envelope.
 * The NestJS API wraps all responses in { success, data, meta }.
 * This interceptor extracts .data so components receive the raw payload.
 */
export const unwrapEnvelopeInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event) => {
      if (
        event.type !== undefined &&
        'body' in event &&
        typeof event.body === 'object' &&
        event.body !== null &&
        'success' in event.body &&
        'data' in event.body
      ) {
        return event.clone({ body: (event.body as { data: unknown }).data });
      }
      return event;
    }),
  );
