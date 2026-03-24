import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type TaskStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'IN_REVIEW'
  | 'COMPLETE'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED';

export interface RegistryRow {
  id: string;
  status: TaskStatus;
  type: string;
  description: string;
  created: string;
}

const VALID_STATUSES: ReadonlyArray<TaskStatus> = [
  'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW',
  'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
];

export function parseRegistry(cwd: string): RegistryRow[] {
  const registryPath = resolve(cwd, 'task-tracking/registry.md');
  if (!existsSync(registryPath)) {
    return [];
  }

  const content = readFileSync(registryPath, 'utf-8');
  const lines = content.split('\n');
  const rows: RegistryRow[] = [];

  for (const line of lines) {
    const match = line.match(
      /^\|\s*(TASK_\d{4}_\d{3})\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*$/
    );
    if (match !== null) {
      const status = match[2] as string;
      if (VALID_STATUSES.includes(status as TaskStatus)) {
        rows.push({
          id: match[1] as string,
          status: status as TaskStatus,
          type: match[3] as string,
          description: match[4]?.trim() ?? '',
          created: match[5] as string,
        });
      }
    }
  }

  return rows;
}
