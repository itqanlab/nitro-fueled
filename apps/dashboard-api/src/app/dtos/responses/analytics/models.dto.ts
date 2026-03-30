/**
 * Analytics DTOs for model usage responses.
 * Contains ModelUsagePointDto and AnalyticsModelsDataDto.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Model usage statistics across all sessions.
 */
export class ModelUsagePointDto {
  @ApiProperty({
    example: 'claude-sonnet-4-20250514',
    description: 'Model identifier',
  })
  public readonly model!: string;

  @ApiProperty({
    example: 100.0,
    description: 'Total cost in USD for this model',
  })
  public readonly totalCost!: number;

  @ApiProperty({
    example: 85,
    description: 'Number of tasks processed with this model',
  })
  public readonly taskCount!: number;

  @ApiProperty({
    example: 4000000,
    description: 'Total tokens consumed by this model',
  })
  public readonly tokenCount!: number;
}

/**
 * Model usage analytics aggregating usage across all models.
 */
export class AnalyticsModelsDataDto {
  @ApiProperty({
    type: [ModelUsagePointDto],
    description: 'Usage breakdown by model',
  })
  public readonly models!: ReadonlyArray<ModelUsagePointDto>;

  @ApiProperty({
    example: 350.0,
    description: 'Total cost in USD across all models',
  })
  public readonly totalCost!: number;

  @ApiProperty({
    example: 1200.0,
    description: 'Hypothetical cost if Opus was used exclusively',
  })
  public readonly hypotheticalOpusCost!: number;

  @ApiProperty({
    example: 850.0,
    description: 'Actual savings vs hypothetical Opus cost',
  })
  public readonly actualSavings!: number;
}
