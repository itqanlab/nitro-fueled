/**
 * Registry response DTOs for API responses.
 * Contains the task registry data structure.
 */

import { ApiProperty } from '@nestjs/swagger';
import { TaskRecordDto } from './task-record.dto';

/**
 * Task registry response containing all registered tasks.
 * Represents the full task registry from task-tracking/registry.md.
 */
export class RegistryResponseDto {
  @ApiProperty({
    type: [TaskRecordDto],
    description: 'Array of all task records in the registry',
    example: [
      {
        id: 'TASK_2026_001',
        status: 'COMPLETE',
        type: 'FEATURE',
        description: 'Add authentication system',
        created: '2024-01-15T10:30:00.000Z',
        model: 'claude-sonnet-4-20250514',
      },
      {
        id: 'TASK_2026_002',
        status: 'IN_PROGRESS',
        type: 'BUGFIX',
        description: 'Fix login redirect issue',
        created: '2024-01-16T09:00:00.000Z',
        model: 'claude-sonnet-4-20250514',
      },
    ],
  })
  public readonly tasks!: ReadonlyArray<TaskRecordDto>;
}
