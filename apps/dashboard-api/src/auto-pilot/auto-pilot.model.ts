/**
 * API request/response DTOs for the auto-pilot endpoints.
 */
import type { LoopStatus, PriorityStrategy, ProviderType, SupervisorConfig } from './auto-pilot.types';

// ============================================================
// Start
// ============================================================

export interface StartAutoPilotRequest {
  readonly taskIds?: ReadonlyArray<string>;
  readonly concurrency?: number;
  readonly limit?: number;
  readonly buildProvider?: ProviderType;
  readonly buildModel?: string;
  readonly reviewProvider?: ProviderType;
  readonly reviewModel?: string;
  readonly priority?: PriorityStrategy;
  readonly retries?: number;
}

export interface StartAutoPilotResponse {
  readonly sessionId: string;
  readonly status: 'starting';
}

// ============================================================
// Stop / Pause
// ============================================================

export interface StopAutoPilotRequest {
  readonly sessionId: string;
}

export interface StopAutoPilotResponse {
  readonly sessionId: string;
  readonly stopped: true;
}

export interface PauseAutoPilotRequest {
  readonly sessionId: string;
}

export interface PauseAutoPilotResponse {
  readonly sessionId: string;
  readonly paused: true;
}

export interface ResumeAutoPilotRequest {
  readonly sessionId: string;
}

export interface ResumeAutoPilotResponse {
  readonly sessionId: string;
  readonly resumed: true;
}

// ============================================================
// Status
// ============================================================

export interface AutoPilotStatusResponse {
  readonly sessionId: string;
  readonly loopStatus: LoopStatus;
  readonly config: SupervisorConfig;
  readonly workers: {
    readonly active: number;
    readonly completed: number;
    readonly failed: number;
  };
  readonly tasks: {
    readonly completed: number;
    readonly failed: number;
    readonly inProgress: number;
    readonly remaining: number;
  };
  readonly startedAt: string;
  readonly uptimeMinutes: number;
  readonly lastHeartbeat: string;
}
