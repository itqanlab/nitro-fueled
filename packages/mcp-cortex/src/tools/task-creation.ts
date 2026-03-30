import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { ToolResult } from './types.js';
import { handleUpsertTask } from './tasks.js';

const TASK_ID_RE = /^TASK_(\d{4})_(\d{3})$/;

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

interface SizingLimits {
  descriptionLines: number;
  acceptanceCriteriaGroups: number;
  fileScope: number;
}

interface ReservedTaskDir {
  taskId: string;
  taskDir: string;
}

interface BulkCreateResult {
  taskId: string;
  folder: string;
  status: string;
  error?: string;
  violations?: SizingViolation[];
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseLimit(rulesText: string, label: string, fallback: number): number {
  const escapedLabel = escapeRegExp(label);
  const match = rulesText.match(new RegExp(`\\|\\s*${escapedLabel}\\s*\\|\\s*[^\\n]*?(\\d+)`, 'i'));
  return match ? parseInt(match[1], 10) : fallback;
}

function readSizingLimits(projectRoot: string): SizingLimits {
  const rulesPath = join(projectRoot, 'task-tracking', 'sizing-rules.md');
  const rulesText = readFileSync(rulesPath, 'utf8');

  return {
    descriptionLines: parseLimit(rulesText, 'Task description length', 150),
    acceptanceCriteriaGroups: parseLimit(rulesText, 'Requirements / acceptance criteria groups', 5),
    fileScope: parseLimit(rulesText, 'Files created or significantly modified', 7),
  };
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
    const match = entry.name.match(TASK_ID_RE);
    if (!match) continue;
    const year = parseInt(match[1], 10);
    const num = parseInt(match[2], 10);
    if (year > maxYear || (year === maxYear && num > maxNum)) {
      maxYear = year;
      maxNum = num;
    }
  }

  return `TASK_${maxYear}_${String(maxNum + 1).padStart(3, '0')}`;
}

function incrementTaskId(taskId: string): string {
  const match = taskId.match(TASK_ID_RE);
  if (!match) {
    throw new Error(`invalid task id: ${taskId}`);
  }

  return `TASK_${match[1]}_${String(parseInt(match[2], 10) + 1).padStart(3, '0')}`;
}

function reserveTaskDirectory(projectRoot: string): ReservedTaskDir {
  const trackingDir = join(projectRoot, 'task-tracking');
  if (!existsSync(trackingDir)) {
    throw new Error('task-tracking directory does not exist');
  }

  let taskId = getNextTaskIdFromDisk(projectRoot);
  while (true) {
    const taskDir = join(trackingDir, taskId);
    try {
      mkdirSync(taskDir, { mode: 0o755 });
      return { taskId, taskDir };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        taskId = incrementTaskId(taskId);
        continue;
      }
      throw error;
    }
  }
}

function stripTemplateComments(template: string): string {
  return template.replace(/\n?<!--([\s\S]*?)-->/g, '');
}

function replaceMetadataRow(content: string, field: string, value: string): string {
  return content.replace(
    new RegExp(`^\\| ${escapeRegExp(field)}\\s*\\|.*$`, 'm'),
    `| ${field.padEnd(21, ' ')} | ${value} |`,
  );
}

function replaceSection(content: string, heading: string, body: string, nextHeading?: string): string {
  const start = `## ${heading}`;
  const pattern = nextHeading
    ? new RegExp(`(${escapeRegExp(start)}\\n\\n)[\\s\\S]*?(?=\\n## ${escapeRegExp(nextHeading)}\\n)`, 'm')
    : new RegExp(`(${escapeRegExp(start)}\\n\\n)[\\s\\S]*$`, 'm');
  return content.replace(pattern, `$1${body}\n`);
}

function detectArchitecturalLayers(description: string): Set<string> {
  const normalized = description.toLowerCase();
  const layers = new Set<string>();

  const layerMatchers: Array<[string, RegExp]> = [
    ['frontend', /\b(ui|ux|frontend|react|component|page|screen)\b/],
    ['api', /\b(api|endpoint|route|handler|controller|mcp)\b/],
    ['data', /\b(db|database|sqlite|schema|migration|query|model)\b/],
    ['infrastructure', /\b(worker|queue|process|session|orchestr|deploy|infra|cli)\b/],
  ];

  for (const [layer, pattern] of layerMatchers) {
    if (pattern.test(normalized)) {
      layers.add(layer);
    }
  }

  return layers;
}

function hasUnrelatedFunctionalAreas(description: string, _fileScope: string[] | undefined): boolean {
  const normalized = description.toLowerCase();
  if (!/\b(and|plus|along with|as well as)\b/.test(normalized)) {
    return false;
  }

  const functionalAreas = new Set<string>();
  const areaMatchers: Array<[string, RegExp]> = [
    ['task-tracking', /\btask[- ]tracking\b|\btask ids?\b|\bbacklog\b/],
    ['dashboard', /\bdashboard\b|\bapp\b|\bfrontend\b/],
    ['cortex', /\bcortex\b|\bmcp\b|\bserver\b/],
    ['docs', /\bdocs?\b|\bdocumentation\b/],
  ];

  for (const [area, pattern] of areaMatchers) {
    if (pattern.test(normalized)) {
      functionalAreas.add(area);
    }
  }

  return functionalAreas.size > 1;
}

function validateSizing(
  projectRoot: string,
  description: string,
  acceptanceCriteria: string[] | undefined,
  fileScope: string[] | undefined,
  complexity: string | undefined,
): SizingViolation[] {
  const limits = readSizingLimits(projectRoot);
  const violations: SizingViolation[] = [];

  const descriptionLines = description.split('\n').length;
  if (descriptionLines > limits.descriptionLines) {
    violations.push({
      rule: 'description_length',
      actual: String(descriptionLines),
      maximum: `${limits.descriptionLines} lines`,
    });
  }

  const criteriaGroups = acceptanceCriteria ?? [];
  if (criteriaGroups.length > limits.acceptanceCriteriaGroups) {
    violations.push({
      rule: 'acceptance_criteria_groups',
      actual: String(criteriaGroups.length),
      maximum: String(limits.acceptanceCriteriaGroups),
    });
  }

  const files = fileScope ?? [];
  if (files.length > limits.fileScope) {
    violations.push({
      rule: 'file_scope',
      actual: String(files.length),
      maximum: `${limits.fileScope} files`,
    });
  }

  const architecturalLayers = detectArchitecturalLayers(description);
  if (complexity === 'Complex' && architecturalLayers.size > 1) {
    violations.push({
      rule: 'complexity_multiple_layers',
      actual: Array.from(architecturalLayers).join(', '),
      maximum: 'single architectural layer',
    });
  }

  if (hasUnrelatedFunctionalAreas(description, files)) {
    violations.push({
      rule: 'unrelated_functional_areas',
      actual: 'multiple unrelated areas detected',
      maximum: 'single functional area',
    });
  }

  return violations;
}

function buildList(items: string[] | undefined, fallback: string, prefix: string): string {
  if (!items || items.length === 0) {
    return fallback;
  }

  return items.map(item => `${prefix}${item}`).join('\n');
}

function buildTaskMd(projectRoot: string, def: TaskDefinition): string {
  const templatePath = join(projectRoot, 'task-tracking', 'task-template.md');
  let content = stripTemplateComments(readFileSync(templatePath, 'utf8')).trimEnd();

  content = content.replace(/^# Task: \[Title\]$/m, `# Task: ${def.title}`);
  content = replaceMetadataRow(content, 'Type', def.type);
  content = replaceMetadataRow(content, 'Priority', def.priority);
  content = replaceMetadataRow(content, 'Complexity', def.complexity ?? 'Medium');
  content = replaceMetadataRow(content, 'Preferred Tier', 'auto');
  content = replaceMetadataRow(content, 'Model', def.model ?? 'default');
  content = replaceMetadataRow(content, 'Testing', 'optional');
  content = replaceMetadataRow(content, 'Poll Interval', 'default');
  content = replaceMetadataRow(content, 'Health Check Interval', 'default');
  content = replaceMetadataRow(content, 'Max Retries', 'default');

  content = replaceSection(content, 'Description', def.description, 'Dependencies');
  content = replaceSection(
    content,
    'Dependencies',
    buildList(def.dependencies, '- None', '- '),
    'Acceptance Criteria',
  );
  content = replaceSection(
    content,
    'Acceptance Criteria',
    buildList(def.acceptanceCriteria, '', '- [ ] '),
    'References',
  );
  content = replaceSection(content, 'References', '- task-tracking/task-template.md', 'File Scope');
  content = replaceSection(content, 'File Scope', buildList(def.fileScope, '- [None]', '- '));

  if (def.parallelism) {
    content = `${content}\n\n## Parallelism\n\n${def.parallelism}`;
  }

  return `${content.trimEnd()}\n`;
}

function gitAddAndCommit(projectRoot: string, files: string[], message: string): void {
  execFileSync('git', ['add', '--', ...files], { cwd: projectRoot, stdio: 'pipe' });

  try {
    execFileSync('git', ['commit', '-m', message], { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    execFileSync('git', ['reset', 'HEAD', '--', ...files], { cwd: projectRoot, stdio: 'pipe' });
    throw new Error('git commit failed');
  }
}

function assertUpsertSucceeded(result: ToolResult): void {
  const payload = result.content[0]?.text;
  if (!payload) {
    throw new Error('upsert_task returned no content');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    throw new Error('upsert_task returned invalid JSON');
  }

  if (parsed.ok !== true) {
    throw new Error(typeof parsed.reason === 'string' ? parsed.reason : 'upsert_task failed');
  }
}

function cleanupTaskDirectory(taskDir: string | undefined): void {
  if (taskDir && existsSync(taskDir)) {
    rmSync(taskDir, { recursive: true, force: true });
  }
}

function cleanupCreatedTask(db: Database.Database, taskId: string | undefined, taskDir: string | undefined): void {
  cleanupTaskDirectory(taskDir);
  if (taskId) {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  }
}

export function handleGetNextTaskId(
  projectRoot: string,
): ToolResult {
  const nextId = getNextTaskIdFromDisk(projectRoot);
  return ok({ nextId });
}

export function handleValidateTaskSizing(
  projectRoot: string,
  args: {
    description: string;
    acceptanceCriteria?: string[];
    fileScope?: string[];
    complexity?: string;
  },
): ToolResult {
  const violations = validateSizing(projectRoot, args.description, args.acceptanceCriteria, args.fileScope, args.complexity);

  if (violations.length === 0) {
    return ok({ valid: true, violations: [] });
  }

  const suggestedSplitCount = Math.max(
    ...violations.map(violation => {
      const actual = parseInt(violation.actual, 10);
      const maximum = parseInt(violation.maximum, 10);
      return Number.isNaN(actual) || Number.isNaN(maximum) || maximum <= 0 ? 2 : Math.ceil(actual / maximum);
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

  const violations = validateSizing(projectRoot, args.description, args.acceptanceCriteria, args.fileScope, args.complexity);
  if (violations.length > 0) {
    return err('oversized', { violations, suggestion: 'use bulk_create_tasks to split' });
  }

  let reserved: ReservedTaskDir | undefined;

  try {
    reserved = reserveTaskDirectory(projectRoot);

    const taskMd = buildTaskMd(projectRoot, args);
    writeFileSync(join(reserved.taskDir, 'task.md'), taskMd, { encoding: 'utf-8', flag: 'wx' });
    writeFileSync(join(reserved.taskDir, 'status'), 'CREATED', { encoding: 'utf-8', flag: 'wx' });

    assertUpsertSucceeded(handleUpsertTask(db, {
      task_id: reserved.taskId,
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
    }));

    const filesToCommit = [
      `task-tracking/${reserved.taskId}/task.md`,
      `task-tracking/${reserved.taskId}/status`,
    ];
    gitAddAndCommit(projectRoot, filesToCommit, `docs(tasks): create ${reserved.taskId} — ${args.title}`);

    return ok({ taskId: reserved.taskId, folder: `task-tracking/${reserved.taskId}`, status: 'CREATED' });
  } catch (error) {
    cleanupCreatedTask(db, reserved?.taskId, reserved?.taskDir);
    const message = error instanceof Error ? error.message : String(error);
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

  const results: BulkCreateResult[] = [];
  const allFilesToCommit: string[] = [];
  const createdIds: string[] = [];
  const createdTasks: ReservedTaskDir[] = [];

  for (const taskDef of args.tasks) {
    if (!taskDef.title || !taskDef.type || !taskDef.priority) {
      results.push({ taskId: '', folder: '', status: 'rejected', error: 'title, type, and priority are required' });
      continue;
    }

    const violations = validateSizing(projectRoot, taskDef.description, taskDef.acceptanceCriteria, taskDef.fileScope, taskDef.complexity);
    if (violations.length > 0) {
      results.push({ taskId: '', folder: '', status: 'rejected', error: 'oversized', violations });
      continue;
    }

    let reserved: ReservedTaskDir | undefined;

    try {
      reserved = reserveTaskDirectory(projectRoot);

      const depsWithWiring = [...(taskDef.dependencies ?? [])];
      if (createdIds.length > 0 && depsWithWiring.length === 0) {
        depsWithWiring.push(createdIds[createdIds.length - 1]);
      }

      const wiredDef = { ...taskDef, dependencies: depsWithWiring };
      const taskMd = buildTaskMd(projectRoot, wiredDef);
      writeFileSync(join(reserved.taskDir, 'task.md'), taskMd, { encoding: 'utf-8', flag: 'wx' });
      writeFileSync(join(reserved.taskDir, 'status'), 'CREATED', { encoding: 'utf-8', flag: 'wx' });

      assertUpsertSucceeded(handleUpsertTask(db, {
        task_id: reserved.taskId,
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
      }));

      allFilesToCommit.push(`task-tracking/${reserved.taskId}/task.md`);
      allFilesToCommit.push(`task-tracking/${reserved.taskId}/status`);
      createdIds.push(reserved.taskId);
      createdTasks.push(reserved);
      results.push({ taskId: reserved.taskId, folder: `task-tracking/${reserved.taskId}`, status: 'CREATED' });
    } catch (error) {
      cleanupCreatedTask(db, reserved?.taskId, reserved?.taskDir);
      const message = error instanceof Error ? error.message : String(error);
      results.push({ taskId: '', folder: '', status: 'failed', error: message });
    }
  }

  if (allFilesToCommit.length > 0) {
    try {
      gitAddAndCommit(projectRoot, allFilesToCommit, `docs(tasks): bulk create ${createdIds.length} tasks`);
    } catch (error) {
      for (const createdTask of createdTasks) {
        cleanupCreatedTask(db, createdTask.taskId, createdTask.taskDir);
      }
      const message = error instanceof Error ? error.message : String(error);
      return errIsError('commit_failed', { results, error: message });
    }
  }

  return ok(results);
}
