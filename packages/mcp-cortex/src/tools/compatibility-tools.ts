import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

interface CompatibilityRow {
  id: number;
  launcher_type: string;
  model: string;
  task_type: string;
  workflow_id: string | null;
  outcome: string;
  duration_ms: number | null;
  cost_estimate: number | null;
  review_pass: number | null;
  created_at: string;
}

interface CompatibilityRecord {
  id: number;
  launcher_type: string;
  model: string;
  task_type: string;
  workflow_id: string | null;
  outcome: string;
  duration_ms: number | null;
  cost_estimate: number | null;
  review_pass: boolean | null;
  created_at: string;
}

interface CompatibilitySummary {
  total: number;
  success_rate: number;
  avg_duration_ms: number | null;
  avg_cost: number | null;
}

function parseCompatibilityRow(row: CompatibilityRow): CompatibilityRecord {
  return {
    id: row.id,
    launcher_type: row.launcher_type,
    model: row.model,
    task_type: row.task_type,
    workflow_id: row.workflow_id,
    outcome: row.outcome,
    duration_ms: row.duration_ms,
    cost_estimate: row.cost_estimate,
    review_pass: row.review_pass === null ? null : row.review_pass === 1,
    created_at: row.created_at,
  };
}

export function handleLogCompatibility(
  db: Database.Database,
  args: {
    launcher_type: string;
    model: string;
    task_type: string;
    workflow_id?: string;
    outcome: string;
    duration_ms?: number;
    cost_estimate?: number;
    review_pass?: boolean;
  },
): ToolResult {
  try {
    const result = db.prepare(`
      INSERT INTO compatibility
        (launcher_type, model, task_type, workflow_id, outcome, duration_ms, cost_estimate, review_pass)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      args.launcher_type,
      args.model,
      args.task_type,
      args.workflow_id ?? null,
      args.outcome,
      args.duration_ms ?? null,
      args.cost_estimate ?? null,
      args.review_pass === undefined ? null : (args.review_pass ? 1 : 0),
    );

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: result.lastInsertRowid }) }] };
  } catch (err) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }),
      }],
    };
  }
}

export function handleQueryCompatibility(
  db: Database.Database,
  args: {
    launcher_type?: string;
    model?: string;
    task_type?: string;
    outcome?: string;
    limit?: number;
  },
): ToolResult {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (args.launcher_type !== undefined) {
    conditions.push('launcher_type = ?');
    params.push(args.launcher_type);
  }
  if (args.model !== undefined) {
    conditions.push('model = ?');
    params.push(args.model);
  }
  if (args.task_type !== undefined) {
    conditions.push('task_type = ?');
    params.push(args.task_type);
  }
  if (args.outcome !== undefined) {
    conditions.push('outcome = ?');
    params.push(args.outcome);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(args.limit ?? 100, 1000);

  const rows = db.prepare(
    `SELECT * FROM compatibility ${where} ORDER BY created_at DESC LIMIT ?`,
  ).all(...params, limit) as CompatibilityRow[];

  const total = rows.length;
  const successCount = rows.filter(r => r.outcome === 'success').length;
  const successRate = total > 0 ? successCount / total : 0;

  const durationsWithValues = rows.filter(r => r.duration_ms !== null);
  const avgDurationMs = durationsWithValues.length > 0
    ? durationsWithValues.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0) / durationsWithValues.length
    : null;

  const costsWithValues = rows.filter(r => r.cost_estimate !== null);
  const avgCost = costsWithValues.length > 0
    ? costsWithValues.reduce((sum, r) => sum + (r.cost_estimate ?? 0), 0) / costsWithValues.length
    : null;

  const summary: CompatibilitySummary = {
    total,
    success_rate: successRate,
    avg_duration_ms: avgDurationMs,
    avg_cost: avgCost,
  };

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ records: rows.map(parseCompatibilityRow), summary }, null, 2),
    }],
  };
}
