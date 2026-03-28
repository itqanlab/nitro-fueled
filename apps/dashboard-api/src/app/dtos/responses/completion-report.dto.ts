/**
 * Completion report DTOs for API responses.
 * Contains the task completion report with files modified and review scores.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * A single review score entry in the completion report.
 */
export class ReviewScoreDto {
  @ApiProperty({
    example: 'Code Style',
    description: 'Name of the review type',
  })
  public readonly review!: string;

  @ApiProperty({
    example: '9/10',
    description: 'Score for this review type',
  })
  public readonly score!: string;
}

/**
 * Task completion report with files, review scores, and fix summary.
 */
export class CompletionReportDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID this completion report belongs to',
  })
  public readonly taskId!: string;

  @ApiProperty({
    type: [String],
    example: ['src/app/auth.service.ts', 'src/app/auth.module.ts'],
    description: 'Files created during this task',
  })
  public readonly filesCreated!: ReadonlyArray<string>;

  @ApiProperty({
    type: [String],
    example: ['src/app/app.module.ts'],
    description: 'Files modified during this task',
  })
  public readonly filesModified!: ReadonlyArray<string>;

  @ApiProperty({
    type: [ReviewScoreDto],
    description: 'Review scores from code review cycle',
  })
  public readonly reviewScores!: ReadonlyArray<ReviewScoreDto>;

  @ApiProperty({
    type: [String],
    example: ['Fixed null guard in processToken()', 'Added error boundary for API calls'],
    description: 'List of findings that were fixed',
  })
  public readonly findingsFixed!: ReadonlyArray<string>;

  @ApiProperty({
    type: [String],
    example: ['Minor style inconsistency acknowledged — will address in next pass'],
    description: 'List of findings acknowledged but not fixed',
  })
  public readonly findingsAcknowledged!: ReadonlyArray<string>;

  @ApiProperty({
    example: 'Missing null guard in token processor',
    description: 'Root cause of any issues found',
  })
  public readonly rootCause!: string;

  @ApiProperty({
    example: 'Added null check at function entry point',
    description: 'Fix applied to resolve root cause',
  })
  public readonly fix!: string;
}
