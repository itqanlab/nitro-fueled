export type AutoPilotSessionStatus = 'starting' | 'running' | 'stopped';

export interface StartAutoPilotOptions {
  readonly dryRun?: boolean;
}

export interface StartAutoPilotRequest {
  readonly taskIds?: ReadonlyArray<string>;
  readonly options?: StartAutoPilotOptions;
}

export interface StartAutoPilotResponse {
  readonly sessionId: string;
  readonly status: 'starting';
}

export interface StopAutoPilotRequest {
  readonly sessionId: string;
}

export interface StopAutoPilotResponse {
  readonly sessionId: string;
  readonly stopped: true;
}

export interface AutoPilotStatusResponse {
  readonly sessionId: string;
  readonly status: AutoPilotSessionStatus;
  readonly updatedAt: string;
}

export interface MockAutoPilotSession {
  readonly sessionId: string;
  readonly taskIds: ReadonlyArray<string>;
  readonly dryRun: boolean;
  readonly createdAt: string;
  readonly pollCount: number;
  readonly stopped: boolean;
}
