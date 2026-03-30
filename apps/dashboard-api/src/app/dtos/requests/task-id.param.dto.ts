/**
 * Request parameter DTOs for path parameter validation.
 */

import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Task ID path parameter DTO with format validation.
 * Expected format: TASK_YYYY_NNN (e.g., TASK_2026_001)
 */
export class TaskIdParamDto {
  @IsString()
  @Matches(/^TASK_\d{4}_\d{3}$/)
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID in format TASK_YYYY_NNN',
  })
  public readonly id!: string;
}
