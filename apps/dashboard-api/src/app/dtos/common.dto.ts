/**
 * Common DTOs for API response envelope and error handling.
 * These provide standardized response structure for all API endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Metadata included in every API response.
 */
export class MetaDto {
  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'ISO 8601 timestamp when the response was generated',
  })
  public readonly timestamp: string = new Date().toISOString();

  @ApiProperty({
    example: 'v1',
    description: 'API version used for the request',
  })
  public readonly version: string = 'v1';
}

/**
 * Standard success response envelope wrapping all API responses.
 * @template T - The type of the response data payload
 */
export class ResponseEnvelopeDto<T> {
  @ApiProperty({
    example: true,
    description: 'Indicates the request was successful',
  })
  public readonly success: true = true;

  @ApiProperty({
    description: 'Response payload containing the requested data',
  })
  public readonly data!: T;

  @ApiProperty({
    type: MetaDto,
    description: 'Response metadata including timestamp and version',
  })
  public readonly meta!: MetaDto;
}

/**
 * Error details for failed API requests.
 */
export class ErrorDto {
  @ApiProperty({
    example: 'NOT_FOUND',
    description: 'Machine-readable error code',
    enum: [
      'BAD_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
      'UNKNOWN_ERROR',
    ],
  })
  public readonly code!: string;

  @ApiProperty({
    example: 'Task not found',
    description: 'Human-readable error message',
  })
  public readonly message!: string;

  @ApiPropertyOptional({
    description: 'Additional error details for debugging',
  })
  public readonly details?: unknown;
}

/**
 * Standard error response envelope for failed API requests.
 */
export class ErrorEnvelopeDto {
  @ApiProperty({
    example: false,
    description: 'Indicates the request failed',
  })
  public readonly success: false = false;

  @ApiProperty({
    type: ErrorDto,
    description: 'Error details including code, message, and optional details',
  })
  public readonly error!: ErrorDto;

  @ApiProperty({
    type: MetaDto,
    description: 'Response metadata including timestamp and version',
  })
  public readonly meta!: MetaDto;
}
