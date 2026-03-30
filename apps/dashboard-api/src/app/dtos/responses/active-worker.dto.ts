/**
 * Active worker DTO for orchestrator state responses.
 * Contains the main ActiveWorkerDto class.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkerType, WorkerStatus } from '../enums/worker.enums';

/**
 * Active worker information in the orchestrator.
 */
export class ActiveWorkerDto {
  @ApiProperty({
    example: 'worker-build-TASK_2026_001-abc123',
    description: 'Unique worker identifier',
  })
  public readonly workerId!: string;

  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID this worker is processing',
  })
  public readonly taskId!: string;

  @ApiProperty({
    enum: WorkerType,
    enumName: 'WorkerType',
    example: WorkerType.Build,
    description: 'Type of worker (Build or Review)',
  })
  public readonly workerType!: WorkerType;

  @ApiProperty({
    example: 'TASK_2026_001-FEATURE-BUILD',
    description: 'Human-readable worker label',
  })
  public readonly label!: string;

  @ApiProperty({
    enum: WorkerStatus,
    enumName: 'WorkerStatus',
    example: WorkerStatus.running,
    description: 'Current worker execution status',
  })
  public readonly status!: WorkerStatus;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'ISO 8601 timestamp when worker was spawned',
  })
  public readonly spawnTime!: string;

  @ApiProperty({
    example: 0,
    description: 'Number of times worker has been detected as stuck',
  })
  public readonly stuckCount!: number;

  @ApiProperty({
    example: '2024-01-15T10:45:00.000Z',
    description: 'ISO 8601 timestamp of last health check',
  })
  public readonly lastHealth!: string;

  @ApiProperty({
    example: 'COMPLETE',
    description: 'Expected end state when worker completes',
  })
  public readonly expectedEndState!: string;

  @ApiPropertyOptional({
    example: 0.45,
    description: 'Accumulated cost in USD',
  })
  public readonly cost?: number;

  @ApiPropertyOptional({
    example: 15000,
    description: 'Total tokens used',
  })
  public readonly tokens?: number;

  @ApiPropertyOptional({
    example: 'claude-sonnet-4-20250514',
    description: 'AI model being used by this worker',
  })
  public readonly model?: string;
}
