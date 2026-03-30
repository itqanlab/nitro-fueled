import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { ToolResult } from './types.js';
import { handleUpsertTask } from './tasks.js';

const TASK_ID_RE = /^TASK_(\d{4})_(\d{3})$/;
const TASK_FOLDER_RE = /^TASK_(\d{4})_(\d{3})$/;

interface SizingViolation {
  rule: string;
  actual: string;
  maximum: string;
}

interface TaskDefinition {
  title: string;
  description: string;
  type: string;
  priority: string;
  complexity?: string;
  model?: string;
  dependencies?: string[];
  acceptanceCriteria?: string[];
  fileScope?: string[];
  parallelism?: string;
}

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function err(reason: string, extra?: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, reason, ...extra }) }] };
}

function errIsError(reason: string, extra?: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, reason, ...extra }) }], isError: true };
}

function getNextTaskIdFromDisk(projectRoot: string): string {
  const trackingDir = join(projectRoot, 'task-tracking');
  if (!existsSync(trackingDir)) {
    return 'TASK_2026_001';
  }

  const entries = readdirSync(trackingDir, { withFileTypes: true });
  let maxYear = 2026;
  let maxNum = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(TASK_FOLDER_RE);
    if (!match) continue;
    const year = parseInt(match[1], 10);
    const num = parseInt(match[2], 10);
    if (year > maxYear || (year === maxYear && num > maxNum)) {
      maxYear = year;
      maxNum = num;
    }
  }

  if (maxNum === 0) {
    return `TASK_2026_001`;
  }

  const nextNum = maxNum + 1;
  const nextId = `TASK_${maxYear}_${String(nextNum).padStart(3, '0')}`;

  if (existsSync(join(trackingDir, nextId))) {
    for (let i = nextNum + 1; i <= 999; i++) {
      const candidate = `TASK_${maxYear}_${String(i).padStart(3, '0')}`;
      if (!existsSync(join(trackingDir, candidate))) {
        return candidate;
      }
    }
  }

  return nextId;
}

function validateSizing(
  description: string,
  acceptanceCriteria: string[] | undefined,
  fileScope: string[] | undefined,
  _complexity: string | undefined,
): SizingViolation[] {
  const violations: SizingViolation[] = [];
  const lines = description.split('\n');
  if (lines.length > 150) {
    violations.push({ rule: 'description_length', actual: String(lines.length), maximum: '150 lines' });
  }

  const criteriaGroups = acceptanceCriteria ?? [];
  if (criteriaGroups.length > 5) {
    violations.push({ rule: 'acceptance_criteria_groups', actual: String(criteriaGroups.length), maximum: '5' });
  }

  const files = fileScope ?? [];
  if (files.length > 7) {
    violations.push({ rule: 'file_scope', actual: String(files.length), maximum: '7 files' });
  }

  return violations;
}

function buildTaskMd(def: TaskDefinition, taskId: string): string {
  const deps = (def.dependencies ?? []).length > 0
    ? def.dependencies!.map(d => `- ${d}`).join('\n')
    : '- None';

  const criteria = (def.acceptanceCriteria ?? []).length > 0
    ? def.acceptanceCriteria!.map(c => `- [ ] ${c}`).join('\n')
    : '- [ ] [To be defined]';

  const scope = (def.fileScope ?? []).length > 0
    ? def.fileScope!.map(f => `- ${f}`).join('\n')
    : '- [None]';

  return `# Task: ${def.title}

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | ${def.type}    |
| Priority              | ${def.priority}|
| Complexity            | ${def.complexity ?? 'Medium'} |
| Preferred Tier        | auto           |
| Model                 | ${def.model ?? 'default'} |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

${def.description}

## Dependencies

${deps}

## Acceptance Criteria

${criteria}

## References

- [None]

## File Scope

${scope}

## Parallelism

${def.parallelism ?? 'No constraints specified.'}
`;
}

function gitAddAndCommit(projectRoot: string, files: string[], message: string): void {
  const args = ['add', '--', ...files];
  execFileSync('git', args, { cwd: projectRoot, stdio: 'pipe' });

  try {
    execFileSync('git', ['commit', '-m', message], { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    execFileSync('git', ['reset', 'HEAD', '--', ...files], { cwd: projectRoot, stdio: 'pipe' });
    throw new Error('git commit failed');
  }
}

export function handleGetNextTaskId(
  projectRoot: string,
): ToolResult {
  const nextId = getNextTaskIdFromDisk(projectRoot);
  return ok({ nextId });
}

export function handleValidateTaskSizing(
  args: {
    description: string;
    acceptanceCriteria?: string[];
    fileScope?: string[];
    complexity?: string;
  },
): ToolResult {
  const violations = validateSizing(args.description, args.acceptanceCriteria, args.fileScope, args.complexity);

  if (violations.length === 0) {
    return ok({ valid: true, violations: [] });
  }

  const suggestedSplitCount = Math.max(
    ...violations.map(v => {
      const actual = parseInt(v.actual, 10);
      const maximum = parseInt(v.maximum, 10);
      return Math.ceil(actual / maximum) || 1;
    }),
  );

  return ok({ valid: false, violations, suggestedSplitCount });
}

export function handleCreateTask(
  db: Database.Database,
  projectRoot: string,
  args: TaskDefinition,
): ToolResult {
  if (!args.title || !args.type || !args.priority) {
    return errIsError('title, type, and priority are required');
  }

  const violations = validateSizing(args.description, args.acceptanceCriteria, args.fileScope, args.complexity);
  if (violations.length > 0) {
    return err('oversized', { violations, suggestion: 'use bulk_create_tasks to split' });
  }

  const taskId = getNextTaskIdFromDisk(projectRoot);
  const taskDir = join(projectRoot, 'task-tracking', taskId);

  try {
    mkdirSync(taskDir, { recursive: true, mode: 0o755 });

    const taskMd = buildTaskMd(args, taskId);
    writeFileSync(join(taskDir, 'task.md'), taskMd, { encoding: 'utf-8' });
    writeFileSync(join(taskDir, 'status'), 'CREATED', { encoding: 'utf-8' });

    handleUpsertTask(db, {
      task_id: taskId,
      fields: {
        title: args.title,
        type: args.type,
        priority: args.priority,
        status: 'CREATED',
        complexity: args.complexity ?? 'Medium',
        model: args.model ?? null,
        dependencies: args.dependencies ?? [],
        description: args.description,
        acceptance_criteria: (args.acceptanceCriteria ?? []).join('\n'),
        file_scope: args.fileScope ?? [],
      },
    });

    const filesToCommit = [
      `task-tracking/${taskId}/task.md`,
      `task-tracking/${taskId}/status`,
    ];
    gitAddAndCommit(projectRoot, filesToCommit, `docs(tasks): create ${taskId} — ${args.title}`);

    return ok({ taskId, folder: `task-tracking/${taskId}`, status: 'CREATED' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return errIsError('creation_failed', { error: message });
  }
}

export function handleBulkCreateTasks(
  db: Database.Database,
  projectRoot: string,
  args: {
    tasks: TaskDefinition[];
  },
): ToolResult {
  if (!Array.isArray(args.tasks) || args.tasks.length === 0) {
    return errIsError('tasks array is required and must not be empty');
  }

  const results: Array<{ taskId: string; folder: string; status: string; error?: string }> = [];
  const allFilesToCommit: string[] = [];
  const createdIds: string[] = [];

  for (const taskDef of args.tasks) {
    if (!taskDef.title || !taskDef.type || !taskDef.priority) {
      results.push({ taskId: '', folder: '', status: 'rejected', error: 'title, type, and priority are required' });
      continue;
    }

    const violations = validateSizing(taskDef.description, taskDef.acceptanceCriteria, taskDef.fileScope, taskDef.complexity);
    if (violations.length > 0) {
      results.push({ taskId: '', folder: '', status: 'rejected', error: 'oversized', ...{ violations } });
      continue;
    }

    const taskId = getNextTaskIdFromDisk(projectRoot);
    const taskDir = join(projectRoot, 'task-tracking', taskId);

    try {
      mkdirSync(taskDir, { recursive: true, mode: 0o755 });

      const depsWithWiring = [...(taskDef.dependencies ?? [])];
      if (createdIds.length > 0 && depsWithWiring.length === 0) {
        depsWithWiring.push(createdIds[createdIds.length - 1]);
      }

      const wiredDef = { ...taskDef, dependencies: depsWithWiring };
      const taskMd = buildTaskMd(wiredDef, taskId);
      writeFileSync(join(taskDir, 'task.md'), taskMd, { encoding: 'utf-8' });
      writeFileSync(join(taskDir, 'status'), 'CREATED', { encoding: 'utf-8' });

      handleUpsertTask(db, {
        task_id: taskId,
        fields: {
          title: wiredDef.title,
          type: wiredDef.type,
          priority: wiredDef.priority,
          status: 'CREATED',
          complexity: wiredDef.complexity ?? 'Medium',
          model: wiredDef.model ?? null,
          dependencies: wiredDef.dependencies ?? [],
          description: wiredDef.description,
          acceptance_criteria: (wiredDef.acceptanceCriteria ?? []).join('\n'),
          file_scope: wiredDef.fileScope ?? [],
        },
      });

      allFilesToCommit.push(`task-tracking/${taskId}/task.md`);
      allFilesToCommit.push(`task-tracking/${taskId}/status`);
      createdIds.push(taskId);
      results.push({ taskId, folder: `task-tracking/${taskId}`, status: 'CREATED' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ taskId: '', folder: '', status: 'failed', error: message });
    }
  }

  if (allFilesToCommit.length > 0) {
    try {
      gitAddAndCommit(projectRoot, allFilesToCommit, `docs(tasks): bulk create ${createdIds.length} tasks`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return errIsError('commit_failed', { results, error: message });
    }
  }

  return ok(results);
}
