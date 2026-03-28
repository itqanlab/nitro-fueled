import type Database from 'better-sqlite3';
import type { WorkerTokenStats, WorkerCost, WorkerProgress } from '../db/schema.js';
import { calculateCost } from './token-calculator.js';
import { CONTEXT_WINDOWS, DEFAULT_CONTEXT_WINDOW } from './token-calculator.js';
import { isProcessAlive, killWorkerProcess } from './spawn.js';

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, string>;
}

interface AssistantMessage {
  type: 'assistant';
  message: {
    model: string;
    content: ContentBlock[];
    usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
    stop_reason: string | null;
  };
}

interface SessionAccumulator {
  totalInput: number;
  totalOutput: number;
  totalCacheCreation: number;
  totalCacheRead: number;
  lastInputTokens: number;
  compactionCount: number;
  messageCount: number;
  toolCalls: number;
  filesRead: Set<string>;
  filesWritten: Set<string>;
  lastAction: string;
  lastActionAt: number;
  /** Unix ms when the accumulator was first created (= process spawn time). Used for elapsed_minutes. */
  spawnTime: number;
  model: string;
  endTurnAt: number | null;
  autoCloseTriggered: boolean;
}

/** Validates that a value is a finite non-negative number (safe for token arithmetic). */
function isFiniteNonNeg(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && v >= 0;
}

export class JsonlWatcher {
  private accumulators = new Map<string, SessionAccumulator>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private db: Database.Database) {}

  start(): void {
    this.pollInterval = setInterval(() => this.pollAll(), 3000);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private pollAll(): void {
    const rows = this.db.prepare(
      "SELECT id, pid, session_id, model, auto_close, launcher FROM workers WHERE status = 'active'",
    ).all() as Array<{ id: string; pid: number; session_id: string; model: string; auto_close: number; launcher: string }>;

    for (const row of rows) {
      if (!row.pid) continue;

      if (!isProcessAlive(row.pid)) {
        const acc = this.accumulators.get(row.id);
        if (acc) {
          this.pushStatsToDB(row.id, acc, row.model);
        }
        this.db.prepare("UPDATE workers SET status = 'completed' WHERE id = ?").run(row.id);
        this.accumulators.delete(row.id);
        continue;
      }

      if (row.auto_close) {
        const acc = this.accumulators.get(row.id);
        if (acc?.endTurnAt && !acc.autoCloseTriggered && Date.now() - acc.endTurnAt > 10_000) {
          acc.autoCloseTriggered = true;
          killWorkerProcess(row.pid);
          this.pushStatsToDB(row.id, acc, row.model);
          this.db.prepare("UPDATE workers SET status = 'completed' WHERE id = ?").run(row.id);
          this.accumulators.delete(row.id);
        }
      }
    }
  }

  feedMessage(workerId: string, model: string, msg: Record<string, unknown>): void {
    const acc = this.getOrCreate(workerId, model);
    this.processMessage(msg, acc);
    // H3: wrap DB write in try/catch so SQLITE_BUSY or any other error does not
    // propagate as an uncaught exception and crash the MCP server.
    try {
      this.pushStatsToDB(workerId, acc, model);
    } catch (err) {
      process.stderr.write(`[jsonl-watcher] pushStatsToDB failed for ${workerId}: ${err}\n`);
    }
  }

  private getOrCreate(workerId: string, model: string): SessionAccumulator {
    let acc = this.accumulators.get(workerId);
    if (!acc) {
      const now = Date.now();
      acc = {
        totalInput: 0, totalOutput: 0,
        totalCacheCreation: 0, totalCacheRead: 0,
        lastInputTokens: 0, compactionCount: 0,
        messageCount: 0, toolCalls: 0,
        filesRead: new Set(), filesWritten: new Set(),
        lastAction: 'spawned', lastActionAt: now,
        spawnTime: now,
        model, endTurnAt: null, autoCloseTriggered: false,
      };
      this.accumulators.set(workerId, acc);
    }
    return acc;
  }

  private processMessage(msg: Record<string, unknown>, acc: SessionAccumulator): void {
    /**
     * Token accumulation contract:
     * - `result` message: provides the authoritative cumulative total. Its usage fields
     *   OVERWRITE the incremental accumulator (totalInput, totalOutput, etc.), superseding
     *   any per-`assistant` increments accumulated so far.
     * - `assistant` message: provides per-message increments that are ACCUMULATED (+=)
     *   until a `result` message supersedes them with the authoritative total.
     */
    if (msg.type === 'last-prompt' || msg.type === 'result') {
      const usage = (msg as Record<string, Record<string, number>>).usage;
      if (msg.type === 'result' && usage) {
        acc.totalInput = usage.input_tokens ?? acc.totalInput;
        acc.totalOutput = usage.output_tokens ?? acc.totalOutput;
        acc.totalCacheCreation = usage.cache_creation_input_tokens ?? acc.totalCacheCreation;
        acc.totalCacheRead = usage.cache_read_input_tokens ?? acc.totalCacheRead;
      }
      if (!acc.endTurnAt) acc.endTurnAt = Date.now();
      return;
    }

    if (msg.type !== 'assistant') return;
    const assistant = msg as unknown as AssistantMessage;
    if (!assistant.message?.usage) return;
    const usage = assistant.message.usage;

    // H9: validate token fields before arithmetic to guard against malformed messages
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;
    if (!isFiniteNonNeg(inputTokens) || !isFiniteNonNeg(outputTokens)) {
      process.stderr.write(
        `[jsonl-watcher] skipping message with invalid token counts: input=${inputTokens} output=${outputTokens}\n`,
      );
      return;
    }
    const cacheCreation = isFiniteNonNeg(usage.cache_creation_input_tokens) ? usage.cache_creation_input_tokens : 0;
    const cacheRead = isFiniteNonNeg(usage.cache_read_input_tokens) ? usage.cache_read_input_tokens : 0;

    acc.totalInput += inputTokens;
    acc.totalOutput += outputTokens;
    acc.totalCacheCreation += cacheCreation;
    acc.totalCacheRead += cacheRead;
    acc.messageCount++;

    // M3: Use 0.3 threshold (tighter than 0.7) to reduce false positives from normal
    // tool-result context trimming. A >70% drop is a much stronger compaction signal.
    if (acc.lastInputTokens > 0 && inputTokens < acc.lastInputTokens * 0.3) {
      acc.compactionCount++;
    }
    acc.lastInputTokens = inputTokens;

    if (assistant.message.content) {
      this.extractToolCalls(assistant.message.content, acc);
    }

    const hasToolUse = assistant.message.content?.some((b) => b.type === 'tool_use');
    if (assistant.message.stop_reason === 'end_turn' && !hasToolUse) {
      acc.endTurnAt = Date.now();
    } else if (hasToolUse) {
      acc.endTurnAt = null;
      acc.autoCloseTriggered = false;
    }
  }

  private extractToolCalls(content: ContentBlock[], acc: SessionAccumulator): void {
    for (const block of content) {
      if (block.type !== 'tool_use') continue;
      acc.toolCalls++;
      acc.lastActionAt = Date.now();
      const name = block.name ?? '';
      const input = block.input;

      if (name === 'Read' && input?.file_path) {
        acc.filesRead.add(input.file_path);
        acc.lastAction = `Read(${shortenPath(input.file_path)})`;
      } else if ((name === 'Write' || name === 'Edit') && input?.file_path) {
        acc.filesWritten.add(input.file_path);
        acc.lastAction = `${name}(${shortenPath(input.file_path)})`;
      } else if (name === 'Bash' && input?.command) {
        acc.lastAction = `Bash(${input.command.substring(0, 60)})`;
      } else {
        acc.lastAction = `${name}(...)`;
      }
    }
  }

  private pushStatsToDB(workerId: string, acc: SessionAccumulator, model: string): void {
    const totalCombined = acc.totalInput + acc.totalOutput + acc.totalCacheCreation + acc.totalCacheRead;
    const contextK = Math.round(acc.lastInputTokens / 1000);
    // H4: Use model-specific context window size so context_percent is accurate across
    // all models. Falls back to DEFAULT_CONTEXT_WINDOW (200k) for unknown models.
    const contextWindow = CONTEXT_WINDOWS[model] ?? DEFAULT_CONTEXT_WINDOW;
    const contextPercent = Math.round((acc.lastInputTokens / contextWindow) * 100);

    const tokens: WorkerTokenStats = {
      total_input: acc.totalInput, total_output: acc.totalOutput,
      total_cache_creation: acc.totalCacheCreation, total_cache_read: acc.totalCacheRead,
      total_combined: totalCombined, context_current_k: contextK,
      context_percent: contextPercent, compaction_count: acc.compactionCount,
    };

    const cost: WorkerCost = calculateCost(
      acc.totalInput, acc.totalOutput,
      acc.totalCacheCreation, acc.totalCacheRead, model,
    );

    // L2: Compute elapsed_minutes from the spawn time recorded in the accumulator.
    const elapsedMinutes = Math.round((Date.now() - acc.spawnTime) / 60_000);

    const progress: WorkerProgress = {
      message_count: acc.messageCount, tool_calls: acc.toolCalls,
      files_read: Array.from(acc.filesRead), files_written: Array.from(acc.filesWritten),
      last_action: acc.lastAction, last_action_at: acc.lastActionAt,
      elapsed_minutes: elapsedMinutes,
    };

    this.db.prepare(
      `UPDATE workers SET tokens_json = ?, cost_json = ?, progress_json = ?, compaction_count = ? WHERE id = ?`,
    ).run(JSON.stringify(tokens), JSON.stringify(cost), JSON.stringify(progress), acc.compactionCount, workerId);
  }
}

function shortenPath(p: string): string {
  const parts = p.split('/');
  return parts.length <= 3 ? p : `.../${parts.slice(-2).join('/')}`;
}
