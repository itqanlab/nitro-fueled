import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

export type TaskStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'IN_REVIEW'
  | 'FIXING'
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
  'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
];

export function parseRegistry(cwd: string): RegistryRow[] {
  const registryPath = resolve(cwd, 'task-tracking/registry.md');
  if (!existsSync(registryPath)) {
    return [];
  }

  let content: string;
  try {
    content = readFileSync(registryPath, 'utf-8');
  } catch {
    console.error(`Warning: Could not read ${registryPath}`);
    return [];
  }

  const lines = content.split('\n');
  const rows: RegistryRow[] = [];

  for (const line of lines) {
    const match = line.match(
      /^\|\s*(TASK_\d{4}_\d{3})\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|(?:\s*[^|]*\s*\|)?\s*$/
    );
    if (match !== null) {
      const status = match[2];
      if (status !== undefined && VALID_STATUSES.includes(status as TaskStatus)) {
        rows.push({
          id: match[1]!,
          status: status as TaskStatus,
          type: match[3]!,
          description: match[4]?.trim() ?? '',
          created: match[5]!,
        });
      }
    }
  }

  return rows;
}

function parseTaskMd(taskMdPath: string): { type: string; description: string; model: string } | null {
  if (!existsSync(taskMdPath)) {
    return null;
  }

  let content: string;
  try {
    content = readFileSync(taskMdPath, 'utf-8');
  } catch {
    return null;
  }

  const titleMatch = content.match(/^#\s+Task:\s+(.+)/m);
  const description = titleMatch !== null ? titleMatch[1]!.trim() : '';

  const typeMatch = content.match(/^\|\s*Type\s*\|\s*(\S+)\s*\|/m);
  const type = typeMatch !== null ? typeMatch[1]!.trim() : '';

  const modelMatch = content.match(/^\|\s*Model\s*\|\s*(.+?)\s*\|/m);
  const model = modelMatch !== null ? modelMatch[1]!.trim() : '—';

  return { type, description, model };
}

export function generateRegistry(cwd: string): void {
  const trackingDir = resolve(cwd, 'task-tracking');
  const registryPath = resolve(trackingDir, 'registry.md');

  // Read existing registry rows for fallback data (Created date, status for tasks missing status file)
  const existingRows = parseRegistry(cwd);
  const existingById = new Map<string, RegistryRow>();
  for (const row of existingRows) {
    existingById.set(row.id, row);
  }

  // Discover all TASK_YYYY_NNN directories, sorted ascending
  let taskDirs: string[];
  try {
    taskDirs = readdirSync(trackingDir)
      .filter((name) => /^TASK_\d{4}_\d{3}$/.test(name))
      .sort();
  } catch {
    console.error(`Warning: Could not read task-tracking directory at ${trackingDir}`);
    return;
  }

  const rows: string[] = [];

  for (const taskId of taskDirs) {
    const taskDir = join(trackingDir, taskId);
    const statusFilePath = join(taskDir, 'status');
    const taskMdPath = join(taskDir, 'task.md');

    // Read status from file; fall back to registry row if missing
    let status: string;
    if (existsSync(statusFilePath)) {
      try {
        status = readFileSync(statusFilePath, 'utf-8').trim();
      } catch {
        console.error(`[warn] ${taskId}: could not read status file, reading state from registry.md`);
        status = existingById.get(taskId)?.status ?? 'CREATED';
      }
    } else {
      console.error(`[warn] ${taskId}: status file missing, reading state from registry.md`);
      status = existingById.get(taskId)?.status ?? 'CREATED';
    }

    // Validate status
    if (!VALID_STATUSES.includes(status as TaskStatus)) {
      console.error(`[warn] ${taskId}: unknown status "${status.slice(0, 64)}", defaulting to CREATED`);
      status = 'CREATED';
    }

    // Read metadata from task.md; fall back to existing registry row
    const taskMeta = parseTaskMd(taskMdPath);
    const existingRow = existingById.get(taskId);

    const type = taskMeta?.type !== undefined && taskMeta.type.length > 0
      ? taskMeta.type
      : (existingRow?.type ?? '');

    const description = taskMeta?.description !== undefined && taskMeta.description.length > 0
      ? taskMeta.description
      : (existingRow?.description ?? '');

    const model = taskMeta?.model !== undefined && taskMeta.model.length > 0
      ? taskMeta.model
      : '—';

    // Created date comes from existing registry row; new tasks not in registry use today
    const today = new Date().toISOString().split('T')[0]!;
    const created = existingRow?.created ?? today;

    const safeDesc = description.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const safeModel = model.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    rows.push(`| ${taskId} | ${status.padEnd(11)} | ${type.padEnd(7)} | ${safeDesc} | ${created} | ${safeModel} |`);
  }

  const header = '<!-- DO NOT EDIT — generated by nitro-fueled status -->';
  const tableHeader = '| Task ID       | Status      | Type    | Description                        | Created    | Model |';
  const tableSeparator = '|---------------|-------------|---------|------------------------------------|------------|-------|';

  const output = [
    header,
    '# Task Registry',
    '',
    tableHeader,
    tableSeparator,
    ...rows,
    '',
  ].join('\n');

  try {
    writeFileSync(registryPath, output, 'utf-8');
  } catch {
    console.error(`Warning: Could not write ${registryPath}`);
  }
}
