import type Database from 'better-sqlite3';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename, resolve, sep } from 'node:path';
import type { ToolResult } from './types.js';

// Map from review-lesson file suffix to the file extensions they cover.
// Files NOT in this map are treated as unknown and are NOT auto-included —
// only files explicitly listed (or with an empty array marker) are included.
const LESSON_FILE_MAP: Record<string, string[]> = {
  'backend.md':        ['ts', 'js', 'mjs', 'cjs', 'py', 'go', 'rs', 'rb', 'java', 'kt', 'cs'],
  'frontend.md':       ['tsx', 'jsx', 'vue', 'svelte', 'html', 'css', 'scss', 'sass', 'less'],
  'review-general.md': null, // null = always include
  'security.md':       ['ts', 'js', 'tsx', 'jsx', 'py', 'go', 'rs', 'rb', 'java', 'kt', 'cs', 'sql', 'sh', 'bash'],
} as unknown as Record<string, string[]>;

// Files NOT in LESSON_FILE_MAP are never auto-included (opt-in, not opt-out).
const ALWAYS_INCLUDE_LESSONS = new Set<string>(['review-general.md']);

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n...[truncated]';
}

function assertInsideBase(base: string, target: string): void {
  const resolved = resolve(target);
  if (!resolved.startsWith(base + sep) && resolved !== base) {
    throw new Error('path_traversal_denied');
  }
}

// ---------------------------------------------------------------------------
// get_task_context
// ---------------------------------------------------------------------------

export function handleGetTaskContext(
  db: Database.Database,
  args: { task_id: string },
  projectRoot: string,
): ToolResult {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(args.task_id) as Record<string, unknown> | undefined;
  if (!task) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }], isError: true };
  }

  const taskTrackingBase = resolve(projectRoot, 'task-tracking');
  const taskFolder = resolve(taskTrackingBase, args.task_id);

  try {
    assertInsideBase(taskTrackingBase, taskFolder);
  } catch {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_task_id' }) }], isError: true };
  }

  // Read plan.md and extract a summary (first 1500 chars)
  const planPath = join(taskFolder, 'plan.md');
  const planRaw = readFileSafe(planPath);
  const planSummary = planRaw ? truncate(planRaw, 1500) : null;

  // Parse file_scope from DB (JSON array) or fall back to task.md File Scope section
  let fileScope: string[] = [];
  try {
    const parsed = JSON.parse((task['file_scope'] as string) ?? '[]');
    if (Array.isArray(parsed)) fileScope = parsed as string[];
  } catch { /* ignore */ }

  // If no file_scope in DB, try reading from task.md
  if (fileScope.length === 0) {
    const taskMdPath = join(taskFolder, 'task.md');
    const taskMd = readFileSafe(taskMdPath);
    const scopeMatch = /##\s+File Scope\n([\s\S]*?)(?:##|$)/.exec(taskMd);
    if (scopeMatch) {
      fileScope = scopeMatch[1]
        .split('\n')
        .map(l => l.replace(/^-\s*`?/, '').replace(/`?\s*$/, '').trim())
        .filter(l => l.length > 0 && !l.startsWith('#'));
    }
  }

  // Parse dependencies
  let deps: string[] = [];
  try {
    const parsed = JSON.parse((task['dependencies'] as string) ?? '[]');
    if (Array.isArray(parsed)) deps = parsed as string[];
  } catch { /* ignore */ }

  const result = {
    ok: true,
    task_id: task['id'],
    title: task['title'],
    type: task['type'],
    priority: task['priority'],
    complexity: task['complexity'],
    status: task['status'],
    description: task['description'] ? truncate(task['description'] as string, 2000) : null,
    acceptance_criteria: task['acceptance_criteria'] ? truncate(task['acceptance_criteria'] as string, 1500) : null,
    file_scope: fileScope,
    dependencies: deps,
    plan_summary: planSummary,
  };

  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

// ---------------------------------------------------------------------------
// get_review_lessons
// ---------------------------------------------------------------------------

export function handleGetReviewLessons(
  _db: Database.Database,
  args: { file_types: string[] },
  projectRoot: string,
): ToolResult {
  const requestedExts = new Set(args.file_types.map(t => t.toLowerCase().replace(/^\./, '')));
  const lessonsDir = join(projectRoot, '.claude', 'review-lessons');

  if (!existsSync(lessonsDir)) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'review_lessons_dir_not_found' }) }], isError: true };
  }

  const files = readdirSync(lessonsDir).filter(f => f.endsWith('.md'));
  const included: Array<{ file: string; content: string }> = [];

  for (const file of files) {
    // Files not in the map are excluded (opt-in inclusion, not opt-out)
    if (!(file in (LESSON_FILE_MAP as Record<string, unknown>)) && !ALWAYS_INCLUDE_LESSONS.has(file)) {
      continue;
    }

    const coverageExts = (LESSON_FILE_MAP as unknown as Record<string, string[] | null>)[file];
    const isAlwaysInclude = ALWAYS_INCLUDE_LESSONS.has(file) || coverageExts === null;
    const isRelevant = isAlwaysInclude || (Array.isArray(coverageExts) && coverageExts.some(ext => requestedExts.has(ext)));

    if (isRelevant) {
      const content = readFileSafe(join(lessonsDir, file));
      if (content) {
        included.push({ file, content: truncate(content, 4000) });
      }
    }
  }

  if (included.length === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, lessons: [], note: 'no lessons matched the requested file types' }) }] };
  }

  const combined = included.map(({ file, content }) => `### ${file}\n\n${content}`).join('\n\n---\n\n');
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, file_types: args.file_types, lesson_files: included.map(f => f.file), content: combined }) }],
  };
}

// ---------------------------------------------------------------------------
// get_recent_changes
// ---------------------------------------------------------------------------

export function handleGetRecentChanges(
  _db: Database.Database,
  args: { task_id: string; include_diff?: boolean },
  projectRoot: string,
): ToolResult {
  const taskIdSafe = args.task_id.replace(/[^A-Z0-9_]/g, '');
  if (!taskIdSafe) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_task_id' }) }], isError: true };
  }

  try {
    // Use NUL (x00) as record separator to avoid pipe-in-subject issues.
    // --max-count caps to 50 commits to bound output size.
    const logResult = spawnSync('git', [
      'log',
      `--grep=${taskIdSafe}`,
      '--max-count=50',
      '--pretty=format:%H%x00%s%x00%ai',
      '--name-only',
    ], { cwd: projectRoot, encoding: 'utf8', timeout: 10_000 });

    if (logResult.status !== 0 || !logResult.stdout.trim()) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, task_id: args.task_id, commits: [], files_changed: [] }) }] };
    }

    const commits: Array<{ hash: string; subject: string; date: string; files: string[] }> = [];
    const allFiles = new Set<string>();

    let currentCommit: { hash: string; subject: string; date: string; files: string[] } | null = null;

    for (const line of logResult.stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentCommit) {
          commits.push(currentCommit);
          currentCommit = null;
        }
        continue;
      }
      // Lines with NUL separators are commit header lines
      if (trimmed.includes('\x00')) {
        const parts = trimmed.split('\x00');
        if (parts.length >= 3 && parts[0] && /^[0-9a-f]{40}/.test(parts[0])) {
          currentCommit = { hash: parts[0].slice(0, 12), subject: parts[1] ?? '', date: parts[2] ?? '', files: [] };
        }
      } else if (currentCommit) {
        currentCommit.files.push(trimmed);
        allFiles.add(trimmed);
      }
    }
    if (currentCommit) commits.push(currentCommit);

    const result: Record<string, unknown> = {
      ok: true,
      task_id: args.task_id,
      commit_count: commits.length,
      commits,
      files_changed: Array.from(allFiles).sort(),
    };

    if (args.include_diff && commits.length > 0 && commits[0]) {
      const statResult = spawnSync('git', ['show', '--stat', commits[0].hash], { cwd: projectRoot, encoding: 'utf8', timeout: 10_000 });
      if (statResult.status === 0) {
        result['latest_commit_stat'] = truncate(statResult.stdout, 2000);
      }
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// get_codebase_patterns
// ---------------------------------------------------------------------------

// Each pattern maps to [nameGlob, directoryContext] pairs used in find commands.
const PATTERN_SEARCH: Record<string, Array<{ name: string; dir?: string }>> = {
  service:     [{ name: '*.service.ts' }, { name: '*.ts', dir: 'services' }],
  component:   [{ name: '*.component.tsx' }, { name: '*.tsx', dir: 'components' }, { name: '*.component.ts' }],
  repository:  [{ name: '*.repository.ts' }, { name: '*.ts', dir: 'repositories' }, { name: '*.ts', dir: 'repos' }],
  controller:  [{ name: '*.controller.ts' }, { name: '*.ts', dir: 'controllers' }],
  handler:     [{ name: '*.handler.ts' }, { name: '*.ts', dir: 'handlers' }],
  middleware:  [{ name: '*.middleware.ts' }, { name: '*.ts', dir: 'middleware' }],
  schema:      [{ name: 'schema.ts' }, { name: '*.schema.ts' }, { name: '*.ts', dir: 'schemas' }],
  test:        [{ name: '*.spec.ts' }, { name: '*.test.ts' }],
  model:       [{ name: '*.model.ts' }, { name: '*.ts', dir: 'models' }],
  util:        [{ name: '*.util.ts' }, { name: '*.ts', dir: 'utils' }, { name: '*.ts', dir: 'helpers' }],
  hook:        [{ name: '*.hook.ts' }, { name: '*.ts', dir: 'hooks' }, { name: '*.tsx', dir: 'hooks' }],
  store:       [{ name: '*.store.ts' }, { name: '*.ts', dir: 'stores' }],
  type:        [{ name: 'types.ts' }, { name: '*.types.ts' }, { name: '*.ts', dir: 'types' }],
  config:      [{ name: 'config.ts' }, { name: '*.config.ts' }, { name: '*.ts', dir: 'configs' }],
  tool:        [{ name: '*.ts', dir: 'tools' }],
};

function findFiles(name: string, dir: string | undefined, rootDir: string, limit: number): string[] {
  const args = ['.',  '-type', 'f', '-name', name,
    '-not', '-path', '*/node_modules/*',
    '-not', '-path', '*/.git/*',
    '-not', '-path', '*/dist/*',
    '-not', '-path', '*/build/*',
  ];
  if (dir) {
    args.push('-path', `*/${dir}/*`);
  }
  const result = spawnSync('find', args, { cwd: rootDir, encoding: 'utf8', timeout: 5_000 });
  if (result.status !== 0) return [];
  return result.stdout.trim().split('\n').filter(Boolean).map(p => p.replace(/^\.\//, '')).slice(0, limit);
}

export function handleGetCodebasePatterns(
  _db: Database.Database,
  args: { pattern_type: string; limit?: number },
  projectRoot: string,
): ToolResult {
  const limit = Math.min(args.limit ?? 3, 10);
  const patternType = args.pattern_type.toLowerCase();
  const searches = PATTERN_SEARCH[patternType];

  if (!searches) {
    const available = Object.keys(PATTERN_SEARCH);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'unknown_pattern_type', available_types: available }) }],
      isError: true,
    };
  }

  const foundFiles = new Set<string>();
  for (const search of searches) {
    if (foundFiles.size >= limit) break;
    const matches = findFiles(search.name, search.dir, projectRoot, limit - foundFiles.size);
    for (const f of matches) {
      foundFiles.add(f);
      if (foundFiles.size >= limit) break;
    }
  }

  const examples: Array<{ path: string; content: string }> = [];
  for (const filePath of foundFiles) {
    const content = readFileSafe(join(projectRoot, filePath));
    if (content) {
      examples.push({ path: filePath, content: truncate(content, 2000) });
    }
  }

  if (examples.length === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, pattern_type: patternType, examples: [], note: 'no files found matching pattern' }) }] };
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, pattern_type: patternType, count: examples.length, examples }, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// stage_and_commit
// ---------------------------------------------------------------------------

interface CommitArgs {
  files: string[];
  message: string;
  task_id: string;
  agent: string;
  phase: string;
  worker_type?: string;
  session_id?: string;
  provider?: string;
  model?: string;
  retry?: string;
  complexity?: string;
  priority?: string;
  version?: string;
}

export function handleStageAndCommit(
  db: Database.Database,
  args: CommitArgs,
  projectRoot: string,
): ToolResult {
  if (!args.files || args.files.length === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_files_provided' }) }], isError: true };
  }

  // Sanitize metadata fields used only in the commit message body (no shell exposure)
  const taskIdSafe = (args.task_id ?? '').replace(/[^A-Z0-9_]/g, '');
  const agentSafe = (args.agent ?? 'unknown').replace(/[^\w-]/g, '');
  const phaseSafe = (args.phase ?? 'unknown').replace(/[^\w-]/g, '');
  const workerSafe = (args.worker_type ?? 'interactive').replace(/[^\w-]/g, '');
  const sessionSafe = (args.session_id ?? 'manual').replace(/[^\w-]/g, '');
  const providerSafe = (args.provider ?? 'claude').replace(/[^\w-]/g, '');
  const modelSafe = (args.model ?? 'unknown').replace(/[^\w. -]/g, '');
  const retrySafe = (args.retry ?? '0/2').replace(/[^\d/]/g, '');
  const complexitySafe = (args.complexity ?? 'Medium').replace(/[^\w-]/g, '');
  const prioritySafe = (args.priority ?? 'P2-Medium').replace(/[^\w-]/g, '');
  const versionSafe = (args.version ?? '0.0.0').replace(/[^\w.-]/g, '');

  // Look up session_id from DB if not provided
  let resolvedSession = sessionSafe;
  if (!args.session_id) {
    try {
      const latestSession = db.prepare(
        "SELECT id FROM sessions WHERE loop_status = 'running' ORDER BY started_at DESC LIMIT 1",
      ).get() as { id: string } | undefined;
      if (latestSession) resolvedSession = latestSession.id.replace(/[^\w-]/g, '');
    } catch { /* best-effort */ }
  }

  const footer = [
    `Task: ${taskIdSafe}`,
    `Agent: ${agentSafe}`,
    `Phase: ${phaseSafe}`,
    `Worker: ${workerSafe}`,
    `Session: ${resolvedSession}`,
    `Provider: ${providerSafe}`,
    `Model: ${modelSafe}`,
    `Retry: ${retrySafe}`,
    `Complexity: ${complexitySafe}`,
    `Priority: ${prioritySafe}`,
    `Generated-By: nitro-fueled v${versionSafe} (https://github.com/itqanlab/nitro-fueled)`,
  ].join('\n');

  const fullMessage = `${args.message}\n\n${footer}`;

  try {
    // Stage files using spawnSync (array form — no shell, no injection surface)
    for (const file of args.files) {
      const stageResult = spawnSync('git', ['add', '--', file], { cwd: projectRoot, timeout: 10_000, encoding: 'utf8' });
      if (stageResult.status !== 0) {
        const stderr = stageResult.stderr?.trim() ?? 'unknown error';
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: `git add failed for '${basename(file)}': ${stderr}` }) }], isError: true };
      }
    }

    // Commit using spawnSync with message on stdin (no shell, no injection surface)
    const commitResult = spawnSync('git', ['commit', '-F', '-'], {
      cwd: projectRoot,
      timeout: 30_000,
      encoding: 'utf8',
      input: fullMessage,
    });

    if (commitResult.status !== 0) {
      const stderr = commitResult.stderr?.trim() ?? 'unknown error';
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: `git commit failed: ${stderr}` }) }], isError: true };
    }

    // Get the new commit hash
    const hashResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: projectRoot, encoding: 'utf8', timeout: 5_000 });
    const commitHash = hashResult.stdout.trim();

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, commit: commitHash, files_staged: args.files.length }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// report_progress
// ---------------------------------------------------------------------------

export function handleReportProgress(
  db: Database.Database,
  args: { task_id: string; phase: string; status: string; details?: string },
): ToolResult {
  const taskIdSafe = args.task_id.replace(/[^A-Z0-9_]/g, '');
  if (!taskIdSafe) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_task_id' }) }], isError: true };
  }

  // Sanitize phase and status before using in event_type column
  const phaseSafe = args.phase.replace(/[^\w-]/g, '').toUpperCase().slice(0, 50);
  const statusSafe = args.status.replace(/[^\w-]/g, '').toUpperCase().slice(0, 50);

  const validStatuses = ['CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED'];

  try {
    const now = new Date().toISOString();

    if (validStatuses.includes(statusSafe)) {
      // Update status in DB
      const result = db.prepare(
        'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
      ).run(statusSafe, now, taskIdSafe);

      if (result.changes === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }], isError: true };
      }

      // Log the event
      db.prepare(
        `INSERT INTO events (session_id, task_id, source, event_type, data) VALUES ('system', ?, 'report_progress', ?, ?)`,
      ).run(taskIdSafe, `PHASE_${phaseSafe}_${statusSafe}`, JSON.stringify({ phase: args.phase, details: args.details ?? null }));

      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, task_id: taskIdSafe, phase: args.phase, status: statusSafe, updated_at: now }) }] };
    } else {
      // Non-standard status — just log the event without updating task status
      db.prepare(
        `INSERT INTO events (session_id, task_id, source, event_type, data) VALUES ('system', ?, 'report_progress', ?, ?)`,
      ).run(taskIdSafe, `PHASE_${phaseSafe}_${statusSafe}`, JSON.stringify({ phase: args.phase, status: args.status, details: args.details ?? null }));

      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, task_id: taskIdSafe, phase: args.phase, status: args.status, note: 'progress event logged (status not a valid task status — no DB update)' }) }] };
    }
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}
