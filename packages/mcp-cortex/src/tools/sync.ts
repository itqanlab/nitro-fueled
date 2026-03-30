import type Database from 'better-sqlite3';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

interface ParsedTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  complexity: string | null;
  model: string | null;
  dependencies: string;
  description: string | null;
  file_scope: string;
}

function parseMetadataField(content: string, field: string): string | null {
  const re = new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|]+)\\|`, 'i');
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

function parseSection(content: string, heading: string): string | null {
  const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

function parseDependencies(content: string): string[] {
  const section = parseSection(content, 'Dependencies');
  if (!section || section.toLowerCase().includes('none')) return [];
  const ids: string[] = [];
  const re = /\bTASK_\d{4}_\d{3}\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(section)) !== null) {
    ids.push(match[0]);
  }
  return ids;
}

function parseFileScope(content: string): string[] {
  const section = parseSection(content, 'File Scope');
  if (!section) return [];
  const files: string[] = [];
  for (const line of section.split('\n')) {
    const trimmed = line.replace(/^[-*]\s*/, '').replace(/`/g, '').trim();
    if (trimmed.length > 0 && !trimmed.startsWith('|')) {
      files.push(trimmed);
    }
  }
  return files;
}

function parseTitle(content: string): string {
  const match = content.match(/^#\s+Task:\s*(.+)/m);
  return match ? match[1].trim() : 'Untitled';
}

function parseTaskFile(taskDir: string, taskId: string): ParsedTask | null {
  const taskPath = join(taskDir, 'task.md');
  if (!existsSync(taskPath)) return null;

  const content = readFileSync(taskPath, 'utf8');

  const statusPath = join(taskDir, 'status');
  const status = existsSync(statusPath) ? readFileSync(statusPath, 'utf8').trim() : 'CREATED';

  return {
    id: taskId,
    title: parseTitle(content),
    type: parseMetadataField(content, 'Type') ?? 'CHORE',
    priority: parseMetadataField(content, 'Priority') ?? 'P2-Medium',
    status,
    complexity: parseMetadataField(content, 'Complexity'),
    model: parseMetadataField(content, 'Model'),
    dependencies: JSON.stringify(parseDependencies(content)),
    description: parseSection(content, 'Description'),
    file_scope: JSON.stringify(parseFileScope(content)),
  };
}

export function handleSyncTasksFromFiles(
  db: Database.Database,
  projectRoot: string,
): { content: Array<{ type: 'text'; text: string }> } {
  const trackingDir = join(projectRoot, 'task-tracking');
  if (!existsSync(trackingDir)) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task-tracking directory not found' }) }] };
  }

  const entries = readdirSync(trackingDir, { withFileTypes: true });
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const upsert = db.prepare(`
    INSERT INTO tasks (id, title, type, priority, status, complexity, model, dependencies, description, file_scope)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      priority = excluded.priority,
      status = excluded.status,
      complexity = excluded.complexity,
      model = excluded.model,
      dependencies = excluded.dependencies,
      description = excluded.description,
      file_scope = excluded.file_scope,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `);

  const runSync = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.isDirectory() || !TASK_ID_RE.test(entry.name)) continue;

      const taskDir = join(trackingDir, entry.name);
      const parsed = parseTaskFile(taskDir, entry.name);

      if (!parsed) {
        skipped++;
        continue;
      }

      try {
        upsert.run(
          parsed.id, parsed.title, parsed.type, parsed.priority,
          parsed.status, parsed.complexity, parsed.model,
          parsed.dependencies, parsed.description, parsed.file_scope,
        );
        imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${parsed.id}: ${message}`);
      }
    }
  });

  runSync();

  const result = { ok: true, imported, skipped, errors: errors.length > 0 ? errors : undefined };
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

const VALID_TASK_STATUSES = new Set([
  'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW',
  'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
]);

export function handleReconcileStatusFiles(
  db: Database.Database,
  projectRoot: string,
): { content: Array<{ type: 'text'; text: string }> } {
  const trackingDir = join(projectRoot, 'task-tracking');
  if (!existsSync(trackingDir)) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task-tracking directory not found' }) }] };
  }

  const entries = readdirSync(trackingDir, { withFileTypes: true });
  let drifted = 0;
  let matched = 0;
  let missingStatusFile = 0;
  let missingDbRow = 0;

  const selectRow = db.prepare('SELECT id, status FROM tasks WHERE id = ?');
  const updateStatus = db.prepare(
    "UPDATE tasks SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  );

  const runReconcile = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.isDirectory() || !TASK_ID_RE.test(entry.name)) continue;

      const statusPath = join(trackingDir, entry.name, 'status');
      if (!existsSync(statusPath)) {
        missingStatusFile++;
        continue;
      }

      const fileStatus = readFileSync(statusPath, 'utf8').trim();
      if (fileStatus.length === 0) {
        missingStatusFile++;
        continue;
      }

      if (!VALID_TASK_STATUSES.has(fileStatus)) {
        missingStatusFile++;
        continue;
      }

      const existing = selectRow.get(entry.name);
      if (!existing || typeof existing !== 'object') {
        missingDbRow++;
        continue;
      }
      const dbRow = existing as { id: string; status: string };

      if (dbRow.status === fileStatus) {
        matched++;
      } else {
        updateStatus.run(fileStatus, entry.name);
        drifted++;
      }
    }
  });

  try {
    runReconcile();
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason }) }] };
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, drifted, matched, missing_status_file: missingStatusFile, missing_db_row: missingDbRow }) }] };
}
