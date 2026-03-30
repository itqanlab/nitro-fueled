/**
 * Full task data DTO for API responses.
 * Aggregates definition, registry record, reviews, and completion report for a single task.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskDefinitionDto, TaskRecordDto } from './task-record.dto';
import { ReviewDataDto } from './review.dto';
import { CompletionReportDto } from './completion-report.dto';

/**
 * Complete task data including definition, registry record, reviews, and completion report.
 * Some fields may be null if the task is in an early lifecycle stage.
 */
export class FullTaskDataDto {
  @ApiPropertyOptional({
    type: TaskDefinitionDto,
    nullable: true,
    description: 'Task definition from task-description.md (null if not yet defined)',
  })
  public readonly definition!: TaskDefinitionDto | null;

  @ApiPropertyOptional({
    type: TaskRecordDto,
    nullable: true,
    description: 'Task registry record (null if not in registry)',
  })
  public readonly registryRecord!: TaskRecordDto | null;

  @ApiProperty({
    type: [ReviewDataDto],
    description: 'Code review results for this task (empty array if no reviews yet)',
  })
  public readonly reviews!: ReadonlyArray<ReviewDataDto>;

  @ApiPropertyOptional({
    type: CompletionReportDto,
    nullable: true,
    description: 'Completion report (null if task not yet complete)',
  })
  public readonly completionReport!: CompletionReportDto | null;
}
