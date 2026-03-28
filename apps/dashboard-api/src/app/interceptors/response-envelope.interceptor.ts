/**
 * Response envelope interceptor.
 * Wraps all successful API responses in a standardized envelope:
 * { success: true, data: ..., meta: { timestamp, version } }
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ResponseEnvelope<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: {
    readonly timestamp: string;
    readonly version: string;
  };
}

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  public intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1',
        },
      })),
    );
  }
}
