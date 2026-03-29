import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { parseRegistry, generateRegistry } from '../utils/registry.js';
import type { RegistryRow, TaskStatus } from '../utils/registry.js';

const TASK_STATUS_VALUES: ReadonlyArray<TaskStatus> = [
  'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW',
  'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
];

function dbRowsToRegistryRows(dbRows: Array<Record<string, unknown>>): RegistryRow[] {
  const result: RegistryRow[] = [];
  for (const row of dbRows) {
    const id = String(row['id'] ?? '');
    if (id.length === 0) continue;
    const rawStatus = String(row['status'] ?? 'CREATED');
    const status = (TASK_STATUS_VALUES.includes(rawStatus as TaskStatus)
      ? rawStatus
      : 'CREATED') as TaskStatus;
    const type = String(row['type'] ?? '');
    const description = String(row['title'] ?? row['description'] ?? '');
    const createdAt = String(row['created_at'] ?? '');
    const created = createdAt.includes('T') ? createdAt.split('T')[0]! : (createdAt || 'Unknown');
    result.push({ id, status, type, description, created });
  }
  return result;
}

interface WorkerEntry {
  workerId: string;
  taskId: string;
  workerType: string;
  label: string;
  status: string;
  health: string;
}

interface PlanInfo {
  activePhase: string;
  activeMilestone: string;
  guidance: string;
  phases: Array<{ name: string; status: string; taskCount: number; completeCount: number }>;
}

const STATUS_ORDER: ReadonlyArray<TaskStatus> = [
  'IN_PROGRESS', 'FIXING', 'CREATED', 'IMPLEMENTED', 'IN_REVIEW',
  'COMPLETE', 'BLOCKED', 'FAILED', 'CANCELLED',
];

function countByStatus(rows: RegistryRow[]): Map<TaskStatus, number> {
  const counts = new Map<TaskStatus, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  return counts;
}

function parseActiveWorkers(cwd: string): WorkerEntry[] {
  const statePath = resolve(cwd, 'task-tracking/orchestrator-state.md');
  if (!existsSync(statePath)) {
    return [];
  }

  let content: string;
  try {
    content = readFileSync(statePath, 'utf-8');
  } catch {
    console.error(`Warning: Could not read ${statePath}`);
    return [];
  }

  const loopMatch = content.match(/\*\*Loop Status\*\*:\s*(\S+)/);
  if (loopMatch === null || loopMatch[1] !== 'RUNNING') {
    return [];
  }

  const lines = content.split('\n');
  const workers: WorkerEntry[] = [];
  let inWorkerTable = false;
  let headerPassed = false;

  for (const line of lines) {
    if (line.includes('## Active Workers')) {
      inWorkerTable = true;
      continue;
    }

    if (inWorkerTable && line.startsWith('##')) {
      break;
    }

    if (!inWorkerTable) {
      continue;
    }

    if (line.startsWith('|') && line.includes('Worker ID')) {
      continue;
    }

    if (line.startsWith('|') && line.includes('---')) {
      headerPassed = true;
      continue;
    }

    if (headerPassed && line.startsWith('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      // Columns: Worker ID | Task | Type | Label | Status | Spawn Time | Health | Started
      if (cells.length >= 7) {
        workers.push({
          workerId: cells[0]!,
          taskId: cells[1]!,
          workerType: cells[2]!,
          label: cells[3]!,
          status: cells[4]!,
          health: cells[6]!,
        });
      }
    }
  }

  return workers;
}

function parsePlan(cwd: string): PlanInfo | null {
  const planPath = resolve(cwd, 'task-tracking/plan.md');
  if (!existsSync(planPath)) {
    return null;
  }

  let content: string;
  try {
    content = readFileSync(planPath, 'utf-8').replace(/\r\n/g, '\n');
  } catch {
    console.error(`Warning: Could not read ${planPath}`);
    return null;
  }

  const activePhaseMatch = content.match(/\*\*Active Phase\*\*:\s*(.+)/);
  const activeMilestoneMatch = content.match(/\*\*Active Milestone\*\*:\s*(.+)/);
  const guidanceMatch = content.match(/\*\*Supervisor Guidance\*\*:\s*(.+)/);

  const phases: PlanInfo['phases'] = [];
  const phaseRegex = /### Phase \d+:\s*(.+)\n\*\*Status\*\*:\s*(.+)/g;
  let match: RegExpExecArray | null;

  while ((match = phaseRegex.exec(content)) !== null) {
    const phaseName = match[1]?.trim() ?? '';
    const phaseStatus = match[2]?.trim() ?? '';

    const phaseStart = match.index;
    const nextPhase = content.indexOf('### Phase', phaseStart + 1);
    const phaseBlock = nextPhase === -1
      ? content.slice(phaseStart)
      : content.slice(phaseStart, nextPhase);

    const taskRows = phaseBlock.match(/^\| TASK_\d{4}_\d{3}/gm);
    const taskCount = taskRows !== null ? taskRows.length : 0;
    const completeRows = phaseBlock.match(/^\| TASK_\d{4}_\d{3}\s*\|[^|]*\|\s*COMPLETE/gm);
    const completeCount = completeRows !== null ? completeRows.length : 0;

    phases.push({ name: phaseName, status: phaseStatus, taskCount, completeCount });
  }

  if (activePhaseMatch === null && phases.length === 0) {
    return null;
  }

  return {
    activePhase: activePhaseMatch?.[1]?.trim() ?? 'Unknown',
    activeMilestone: activeMilestoneMatch?.[1]?.trim() ?? 'None',
    guidance: guidanceMatch?.[1]?.trim() ?? 'N/A',
    phases,
  };
}

function displayBrief(rows: RegistryRow[], workers: WorkerEntry[]): void {
  const counts = countByStatus(rows);
  const complete = counts.get('COMPLETE') ?? 0;
  const total = rows.length;
  const inProgress = counts.get('IN_PROGRESS') ?? 0;
  const created = counts.get('CREATED') ?? 0;
  const blocked = counts.get('BLOCKED') ?? 0;

  const parts: string[] = [
    `${total} tasks`,
    `${complete} complete`,
    `${inProgress} building`,
    `${created} ready`,
  ];

  if (blocked > 0) {
    parts.push(`${blocked} blocked`);
  }

  if (workers.length > 0) {
    parts.push(`${workers.length} workers active`);
  }

  console.log(parts.join(' | '));
}

function displayFull(rows: RegistryRow[], workers: WorkerEntry[], plan: PlanInfo | null): void {
  const counts = countByStatus(rows);

  console.log('');
  console.log('NITRO-FUELED STATUS');
  console.log('===================');
  console.log('');

  // Task summary
  console.log('Task Summary');
  console.log('------------');
  console.log(`Total: ${rows.length}`);
  for (const status of STATUS_ORDER) {
    const count = counts.get(status);
    if (count !== undefined && count > 0) {
      console.log(`  ${status}: ${count}`);
    }
  }
  console.log('');

  // Active workers
  if (workers.length > 0) {
    console.log('Active Workers (Supervisor Running)');
    console.log('-----------------------------------');
    for (const w of workers) {
      console.log(`  ${w.taskId} | ${w.workerType} Worker | ${w.health} | ${w.label}`);
    }
    console.log('');
  }

  // Plan progress
  if (plan !== null) {
    console.log('Plan Progress');
    console.log('-------------');
    console.log(`Active Phase: ${plan.activePhase}`);
    console.log(`Active Milestone: ${plan.activeMilestone}`);
    console.log(`Supervisor Guidance: ${plan.guidance}`);

    if (plan.phases.length > 0) {
      console.log('');
      for (const phase of plan.phases) {
        const pct = phase.taskCount > 0
          ? Math.round((phase.completeCount / phase.taskCount) * 100)
          : 0;
        console.log(`  ${phase.name}: ${phase.status} (${phase.completeCount}/${phase.taskCount} tasks, ${pct}%)`);
      }
    }
    console.log('');
  }

  // Task detail table
  console.log('Task Details');
  console.log('------------');

  const idWidth = 15;
  const statusWidth = 13;
  const typeWidth = 15;
  const descWidth = 45;

  const header = [
    'ID'.padEnd(idWidth),
    'Status'.padEnd(statusWidth),
    'Type'.padEnd(typeWidth),
    'Description',
  ].join('  ');

  const separator = [
    '-'.repeat(idWidth),
    '-'.repeat(statusWidth),
    '-'.repeat(typeWidth),
    '-'.repeat(descWidth),
  ].join('  ');

  console.log(header);
  console.log(separator);

  for (const row of rows) {
    const desc = row.description.length > descWidth
      ? row.description.slice(0, descWidth - 3) + '...'
      : row.description;
    const line = [
      row.id.padEnd(idWidth),
      row.status.padEnd(statusWidth),
      row.type.padEnd(typeWidth),
      desc,
    ].join('  ');
    console.log(line);
  }

  // Blockers / attention needed
  const blockers = rows.filter((r) => r.status === 'BLOCKED' || r.status === 'FAILED');
  if (blockers.length > 0) {
    console.log('');
    console.log('Needs Attention');
    console.log('---------------');
    for (const b of blockers) {
      console.log(`  ${b.id} (${b.status}): ${b.description}`);
    }
  }

  console.log('');
}

export default class Status extends BaseCommand {
  public static override description = 'Show task statuses, active workers, and plan progress';

  public static override flags = {
    brief: Flags.boolean({ description: 'Show one-line summary', default: false }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Status);
    const cwd = process.cwd();

    const dbPath = resolve(cwd, '.nitro', 'cortex.db');
    let rows: RegistryRow[] = [];
    let usedDb = false;

    if (existsSync(dbPath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3') as typeof import('better-sqlite3');
        const db = new Database(dbPath, { readonly: true });
        try {
          const dbRows = db.prepare('SELECT * FROM tasks ORDER BY id').all() as Array<Record<string, unknown>>;
          rows = dbRowsToRegistryRows(dbRows);
          usedDb = true;
        } finally {
          db.close();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
        this.warn(`cortex DB unavailable (${msg}), falling back to file scan`);
      }
    }

    if (!usedDb) {
      generateRegistry(cwd);
      rows = parseRegistry(cwd);
    }

    const workers = parseActiveWorkers(cwd);

    if (rows.length === 0) {
      const registryPath = resolve(cwd, 'task-tracking/registry.md');
      if (!existsSync(registryPath)) {
        console.log('No task registry found. Run `npx nitro-fueled init` first.');
      } else {
        console.log('No tasks in registry.');
      }
      return;
    }

    if (flags.brief) {
      displayBrief(rows, workers);
      return;
    }

    const plan = parsePlan(cwd);
    displayFull(rows, workers, plan);
  }
}
