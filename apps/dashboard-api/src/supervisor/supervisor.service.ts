import { Injectable } from '@nestjs/common';

export interface StartSessionConfig {
  concurrency?: number;
  intervalMs?: number;
}

export interface SessionStartResult {
  ok: true;
  session_id: string;
  message: string;
}

export interface SessionActionResult {
  ok: true;
  session_id: string;
  status: string;
  message: string;
}

export interface SessionStatusResult {
  session_id: string;
  status: string;
  workers_active: number;
  tasks_running: number;
}

@Injectable()
export class SupervisorService {
  startSession(_config: StartSessionConfig): SessionStartResult {
    throw new Error('SupervisorService not yet implemented — pending TASK_2026_338');
  }

  pauseSession(_id: string): SessionActionResult | null {
    throw new Error('SupervisorService not yet implemented — pending TASK_2026_338');
  }

  resumeSession(_id: string): SessionActionResult | null {
    throw new Error('SupervisorService not yet implemented — pending TASK_2026_338');
  }

  stopSession(_id: string): SessionActionResult | null {
    throw new Error('SupervisorService not yet implemented — pending TASK_2026_338');
  }

  getSessionStatus(_id: string): SessionStatusResult | null {
    throw new Error('SupervisorService not yet implemented — pending TASK_2026_338');
  }
}
