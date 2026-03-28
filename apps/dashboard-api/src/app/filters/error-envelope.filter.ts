/**
 * Error envelope exception filter.
 * Catches all exceptions and transforms them into a standardized error envelope:
 * { success: false, error: { code, message, details? }, meta: { timestamp, version } }
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
  readonly meta: {
    readonly timestamp: string;
    readonly version: string;
  };
}

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = this.mapStatusToCode(status);
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = typeof responseObj['message'] === 'string'
          ? responseObj['message']
          : typeof responseObj['error'] === 'string'
            ? responseObj['error']
            : message;
        if (responseObj['details'] !== undefined) {
          details = responseObj['details'];
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorEnvelope: ErrorEnvelope = {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    response.status(status).json(errorEnvelope);
  }

  private mapStatusToCode(status: number): string {
    const statusMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
    };
    return statusMap[status] ?? 'UNKNOWN_ERROR';
  }
}
