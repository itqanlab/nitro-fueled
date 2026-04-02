/**
 * Terminal output formatter for SupervisorEngine events.
 *
 * Subscribes to engine EventEmitter and renders colored progress output.
 * Uses ANSI escape codes directly to avoid external color dependencies.
 */

import { EventEmitter } from 'node:events';
import type { CycleStats } from '@itqanlab/nitro-cortex/supervisor';

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
} as const;

function ts(): string {
  return new Date().toTimeString().slice(0, 8);
}

function dim(s: string): string {
  return `${C.gray}${s}${C.reset}`;
}

function bold(s: string): string {
  return `${C.bold}${s}${C.reset}`;
}

// ── Session summary tracking ──────────────────────────────────────────────────

export interface SessionSummary {
  tasksCompleted: number;
  tasksFailed: number;
  totalWorkersSpawned: number;
  startMs: number;
}

// ── Attach output handler ─────────────────────────────────────────────────────

/**
 * Attach terminal output listeners to a SupervisorEngine (or any EventEmitter
 * that emits the same engine events). Returns a summary object that is updated
 * in place as events arrive so callers can print it on exit.
 */
export function attachEngineOutput(engine: EventEmitter): SessionSummary {
  const summary: SessionSummary = {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalWorkersSpawned: 0,
    startMs: Date.now(),
  };

  engine.on('cycle:start', () => {
    process.stdout.write(dim(`[${ts()}] cycle tick\n`));
  });

  engine.on('cycle:end', (stats: CycleStats) => {
    if (stats.spawned > 0 || stats.killed > 0 || stats.transitioned > 0) {
      process.stdout.write(
        dim(`[${ts()}] cycle: `) +
        (stats.spawned > 0 ? `${C.green}+${stats.spawned} spawned${C.reset} ` : '') +
        (stats.killed > 0 ? `${C.red}-${stats.killed} killed${C.reset} ` : '') +
        (stats.transitioned > 0 ? `${C.cyan}~${stats.transitioned} transitioned${C.reset}` : '') +
        '\n',
      );
    }
  });

  engine.on('worker:spawned', (evt: { taskId: string; workerId: string; model: string; provider: string }) => {
    summary.totalWorkersSpawned++;
    process.stdout.write(
      `${C.green}${C.bold}[${ts()}] SPAWN${C.reset} ` +
      `${bold(evt.taskId)} → worker ${dim(evt.workerId.slice(-8))} ` +
      `${dim(`[${evt.provider}/${evt.model}]`)}\n`,
    );
  });

  engine.on('worker:killed', (evt: { workerId: string; taskId: string | null; reason: string }) => {
    process.stdout.write(
      `${C.red}${C.bold}[${ts()}] KILL${C.reset} ` +
      `worker ${dim(evt.workerId.slice(-8))}` +
      (evt.taskId ? ` (${bold(evt.taskId)})` : '') +
      ` — ${C.yellow}${evt.reason}${C.reset}\n`,
    );
  });

  engine.on('task:transitioned', (evt: { taskId: string; from: string; to: string }) => {
    const isComplete = evt.to === 'COMPLETE';
    const isFailed = evt.to === 'FAILED' || evt.to === 'BLOCKED';

    if (isComplete) {
      summary.tasksCompleted++;
      process.stdout.write(
        `${C.green}${C.bold}[${ts()}] DONE${C.reset} ` +
        `${bold(evt.taskId)} ${dim(`${evt.from} → ${evt.to}`)}\n`,
      );
    } else if (isFailed) {
      summary.tasksFailed++;
      process.stdout.write(
        `${C.red}${C.bold}[${ts()}] FAIL${C.reset} ` +
        `${bold(evt.taskId)} ${dim(`${evt.from} → ${evt.to}`)}\n`,
      );
    } else {
      process.stdout.write(
        `${C.cyan}[${ts()}] TRANSITION${C.reset} ` +
        `${bold(evt.taskId)} ${dim(`${evt.from} → ${evt.to}`)}\n`,
      );
    }
  });

  engine.on('engine:error', (evt: { error: Error }) => {
    process.stdout.write(
      `${C.red}${C.bold}[${ts()}] ENGINE ERROR${C.reset} ${evt.error.message}\n`,
    );
  });

  return summary;
}

/**
 * Print the final session summary to stdout.
 */
export function printSessionSummary(summary: SessionSummary): void {
  const durationMs = Date.now() - summary.startMs;
  const durationSec = Math.round(durationMs / 1000);
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  process.stdout.write('\n');
  process.stdout.write(`${C.bold}─── Session Summary ───────────────────────────${C.reset}\n`);
  process.stdout.write(`  Tasks completed : ${C.green}${bold(String(summary.tasksCompleted))}${C.reset}\n`);
  if (summary.tasksFailed > 0) {
    process.stdout.write(`  Tasks failed    : ${C.red}${bold(String(summary.tasksFailed))}${C.reset}\n`);
  }
  process.stdout.write(`  Workers spawned : ${summary.totalWorkersSpawned}\n`);
  process.stdout.write(`  Duration        : ${durationStr}\n`);
  process.stdout.write(`${C.bold}───────────────────────────────────────────────${C.reset}\n\n`);
}
