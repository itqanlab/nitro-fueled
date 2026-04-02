import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  capabilities: string;
  prompt_template: string | null;
  launcher_compatibility: string;
  created_at: string;
  updated_at: string;
}

interface AgentRecord {
  id: string;
  name: string;
  description: string | null;
  capabilities: string[];
  prompt_template: string | null;
  launcher_compatibility: string[];
  created_at: string;
  updated_at: string;
}

const UPDATABLE_AGENT_COLUMNS = new Set([
  'name', 'description', 'capabilities', 'prompt_template', 'launcher_compatibility',
]);

function parseAgentRow(row: AgentRow): AgentRecord {
  return {
    ...row,
    capabilities: JSON.parse(row.capabilities) as string[],
    launcher_compatibility: JSON.parse(row.launcher_compatibility) as string[],
  };
}

export function handleListAgents(
  db: Database.Database,
  args: { capability?: string; launcher?: string; limit?: number },
): ToolResult {
  const limit = Math.min(args.limit ?? 100, 500);
  let rows: AgentRow[];

  if (args.capability !== undefined && args.launcher !== undefined) {
    rows = db.prepare(
      `SELECT * FROM agents WHERE capabilities LIKE ? AND launcher_compatibility LIKE ? ORDER BY name LIMIT ?`,
    ).all(`%${args.capability}%`, `%${args.launcher}%`, limit) as AgentRow[];
  } else if (args.capability !== undefined) {
    rows = db.prepare(
      `SELECT * FROM agents WHERE capabilities LIKE ? ORDER BY name LIMIT ?`,
    ).all(`%${args.capability}%`, limit) as AgentRow[];
  } else if (args.launcher !== undefined) {
    rows = db.prepare(
      `SELECT * FROM agents WHERE launcher_compatibility LIKE ? ORDER BY name LIMIT ?`,
    ).all(`%${args.launcher}%`, limit) as AgentRow[];
  } else {
    rows = db.prepare(`SELECT * FROM agents ORDER BY name LIMIT ?`).all(limit) as AgentRow[];
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(rows.map(parseAgentRow), null, 2),
    }],
  };
}

export function handleGetAgent(
  db: Database.Database,
  args: { id: string },
): ToolResult {
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(args.id) as AgentRow | undefined;
  if (!row) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'agent_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(parseAgentRow(row), null, 2) }] };
}

export function handleCreateAgent(
  db: Database.Database,
  args: {
    id: string;
    name: string;
    description?: string;
    capabilities?: string[];
    prompt_template?: string;
    launcher_compatibility?: string[];
  },
): ToolResult {
  const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(args.id) as { id: string } | undefined;
  if (existing) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'agent_already_exists' }) }] };
  }

  try {
    db.prepare(
      `INSERT INTO agents (id, name, description, capabilities, prompt_template, launcher_compatibility)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      args.id,
      args.name,
      args.description ?? null,
      JSON.stringify(args.capabilities ?? []),
      args.prompt_template ?? null,
      JSON.stringify(args.launcher_compatibility ?? []),
    );

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: args.id }) }] };
  } catch (err) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }),
      }],
    };
  }
}

export function handleUpdateAgent(
  db: Database.Database,
  args: { id: string; fields: Record<string, unknown> },
): ToolResult {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(args.fields)) {
    if (!UPDATABLE_AGENT_COLUMNS.has(key)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: false, reason: `column '${key}' not updatable` }),
        }],
      };
    }
    sets.push(`${key} = ?`);
    if ((key === 'capabilities' || key === 'launcher_compatibility') && Array.isArray(value)) {
      params.push(JSON.stringify(value));
    } else {
      params.push(value);
    }
  }

  if (sets.length === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no fields provided' }) }] };
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(args.id);

  const info = db.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'agent_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}

export function handleDeleteAgent(
  db: Database.Database,
  args: { id: string },
): ToolResult {
  const info = db.prepare('DELETE FROM agents WHERE id = ?').run(args.id);
  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'agent_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}
