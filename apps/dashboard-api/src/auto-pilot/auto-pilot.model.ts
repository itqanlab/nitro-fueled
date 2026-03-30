/**
 * API request/response DTOs for the session-centric auto-pilot endpoints.
 *
 * Uses camelCase field names for the HTTP API layer. The facade
 * (auto-pilot.service.ts) maps these to snake_case SupervisorConfig keys.
 */
import type {
  PriorityStrategy,
  ProviderType,
  SupervisorConfig,
  SessionStatusResponse,
} from './auto-pilot.types';

// ============================================================
// Create Session
// ============================================================

export interface CreateSessionRequest {
  readonly concurrency?: number;
  readonly limit?: number;
  readonly buildProvider?: ProviderType;
  readonly buildModel?: string;
  readonly reviewProvider?: ProviderType;
  readonly reviewModel?: string;
  readonly priority?: PriorityStrategy;
  readonly retries?: number;
}

export interface CreateSessionResponse {
  readonly sessionId: string;
  readonly status: 'starting';
}

// ============================================================
// Update Session Config
// ============================================================

export interface UpdateSessionConfigRequest {
  readonly concurrency?: number;
  readonly limit?: number;
  readonly buildProvider?: ProviderType;
  readonly buildModel?: string;
  readonly reviewProvider?: ProviderType;
  readonly reviewModel?: string;
  readonly priority?: PriorityStrategy;
  readonly retries?: number;
  readonly pollIntervalMs?: number;
}

export interface UpdateSessionConfigResponse {
  readonly sessionId: string;
  readonly config: SupervisorConfig;
}

// ============================================================
// Session Actions (Stop / Pause / Resume)
// ============================================================

export interface SessionActionResponse {
  readonly sessionId: string;
  readonly action: 'stopped' | 'paused' | 'resumed';
}

// ============================================================
// List Sessions
// ============================================================

export interface ListSessionsResponse {
  readonly sessions: ReadonlyArray<SessionStatusResponse>;
}
