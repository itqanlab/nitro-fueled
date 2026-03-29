import type { CortexSession } from '../../../../../dashboard-api/src/dashboard/cortex.types';

export interface SessionRow {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationHours: number | null;
  totalCost: number;
  tasksTerminal: number;
  supervisorModel: string;
  supervisorLauncher: string;
  mode: string;
  loopStatus: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  costPerTask: number | null;
  statusClass: 'status-active' | 'status-done' | 'status-failed' | 'status-unknown';
  isSelected: boolean;
}

export const FALLBACK_SESSION_ROWS: SessionRow[] = [];

function computeStatusClass(
  loopStatus: string,
): 'status-active' | 'status-done' | 'status-failed' | 'status-unknown' {
  if (loopStatus === 'running') return 'status-active';
  if (loopStatus === 'complete') return 'status-done';
  if (loopStatus === 'failed') return 'status-failed';
  return 'status-unknown';
}

function computeDurationHours(startedAt: string, endedAt: string | null): number | null {
  if (!endedAt) return null;
  const diff = Date.parse(endedAt) - Date.parse(startedAt);
  if (isNaN(diff)) return null;
  return diff / 3_600_000;
}

export function adaptSessions(raw: CortexSession[] | null): SessionRow[] {
  if (!raw) return FALLBACK_SESSION_ROWS;
  return raw.map((item): SessionRow => ({
    id: item.id,
    startedAt: item.started_at,
    endedAt: item.ended_at,
    durationHours: computeDurationHours(item.started_at, item.ended_at),
    totalCost: item.total_cost,
    tasksTerminal: item.tasks_terminal,
    supervisorModel: item.supervisor_model,
    supervisorLauncher: item.supervisor_launcher,
    mode: item.mode,
    loopStatus: item.loop_status,
    totalInputTokens: item.total_input_tokens,
    totalOutputTokens: item.total_output_tokens,
    costPerTask: item.tasks_terminal > 0 ? item.total_cost / item.tasks_terminal : null,
    statusClass: computeStatusClass(item.loop_status),
    isSelected: false,
  }));
}
