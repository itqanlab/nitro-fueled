/**
 * Review finding and review data DTOs for API responses.
 * Converted from dashboard.types.ts ReviewFinding and ReviewData interfaces.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * A single review finding item (question + content pair).
 */
export class ReviewFindingDto {
  @ApiProperty({
    example: 'Does the code handle error cases?',
    description: 'The review question or criteria being assessed',
  })
  public readonly question!: string;

  @ApiProperty({
    example: 'Error handling is present for all async operations',
    description: 'The finding content or answer for this review question',
  })
  public readonly content!: string;
}

/**
 * Review data for a task including score, assessment, and individual findings.
 */
export class ReviewDataDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task identifier this review belongs to',
  })
  public readonly taskId!: string;

  @ApiProperty({
    example: 'logic',
    description: 'Type of review (logic, style, security, etc.)',
  })
  public readonly reviewType!: string;

  @ApiProperty({
    example: '8/10',
    description: 'Overall review score',
  })
  public readonly overallScore!: string;

  @ApiProperty({
    example: 'PASS',
    description: 'Overall assessment result',
  })
  public readonly assessment!: string;

  @ApiProperty({
    example: 0,
    description: 'Number of critical severity issues found',
  })
  public readonly criticalIssues!: number;

  @ApiProperty({
    example: 1,
    description: 'Number of serious severity issues found',
  })
  public readonly seriousIssues!: number;

  @ApiProperty({
    example: 2,
    description: 'Number of moderate severity issues found',
  })
  public readonly moderateIssues!: number;

  @ApiProperty({
    type: [ReviewFindingDto],
    description: 'List of individual review findings',
  })
  public readonly findings!: ReadonlyArray<ReviewFindingDto>;
}
