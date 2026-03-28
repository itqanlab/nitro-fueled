/**
 * Session DTOs for API responses.
 * Contains session summary and full session data including orchestrator state.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrchestratorStateDto } from './orchestrator-state.dto';
import { LogEntryDto } from './worker-state.dto';

/**
 * Session summary for list views.
 * Provides key session info without the full state payload.
 */
export class SessionSummaryDto {
  @ApiProperty({
    example: 'SESSION_2026-03-15_10-30-00',
    description: 'Unique session identifier',
  })
  public readonly sessionId!: string;

  @ApiProperty({
    example: true,
    description: 'Whether this session is currently active',
  })
  public readonly isActive!: boolean;

  @ApiProperty({
    example: 'auto-pilot',
    description: 'Source that started the session (e.g., orchestrate, auto-pilot)',
  })
  public readonly source!: string;

  @ApiProperty({
    example: '10:30',
    description: 'Time when the session started',
  })
  public readonly started!: string;

  @ApiProperty({
    example: 'task-tracking/sessions/SESSION_2026-03-15_10-30-00/',
    description: 'Filesystem path to the session directory',
  })
  public readonly path!: string;

  @ApiProperty({
    example: 5,
    description: 'Number of tasks being handled in this session',
  })
  public readonly taskCount!: number;

  @ApiProperty({
    example: 'running',
    description: 'Orchestrator loop status (running, paused, stopped)',
  })
  public readonly loopStatus!: string;

  @ApiProperty({
    example: '2024-01-15T10:45:00.000Z',
    description: 'ISO 8601 timestamp of last state update',
  })
  public readonly lastUpdated!: string;
}

/**
 * Full session data including summary, orchestrator state, and log.
 */
export class SessionDataDto {
  @ApiProperty({
    type: SessionSummaryDto,
    description: 'Session summary information',
  })
  public readonly summary!: SessionSummaryDto;

  @ApiPropertyOptional({
    type: OrchestratorStateDto,
    nullable: true,
    description: 'Full orchestrator state (null if state file not available)',
  })
  public readonly state!: OrchestratorStateDto | null;

  @ApiProperty({
    type: [LogEntryDto],
    description: 'Session log entries',
  })
  public readonly log!: ReadonlyArray<LogEntryDto>;
}
