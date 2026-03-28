import type Database from 'better-sqlite3';
import type { WorkerTokenStats, WorkerCost, WorkerProgress } from '../db/schema.js';
import { calculateCost } from './token-calculator.js';
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
  model: string;
  endTurnAt: number | null;
  autoCloseTriggered: boolean;
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
    this.pushStatsToDB(workerId, acc, model);
  }

  private getOrCreate(workerId: string, model: string): SessionAccumulator {
    let acc = this.accumulators.get(workerId);
    if (!acc) {
      acc = {
        totalInput: 0, totalOutput: 0,
        totalCacheCreation: 0, totalCacheRead: 0,
        lastInputTokens: 0, compactionCount: 0,
        messageCount: 0, toolCalls: 0,
        filesRead: new Set(), filesWritten: new Set(),
        lastAction: 'spawned', lastActionAt: Date.now(),
        model, endTurnAt: null, autoCloseTriggered: false,
      };
      this.accumulators.set(workerId, acc);
    }
    return acc;
  }

  private processMessage(msg: Record<string, unknown>, acc: SessionAccumulator): void {
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

    acc.totalInput += usage.input_tokens;
    acc.totalOutput += usage.output_tokens;
    acc.totalCacheCreation += usage.cache_creation_input_tokens ?? 0;
    acc.totalCacheRead += usage.cache_read_input_tokens ?? 0;
    acc.messageCount++;

    if (acc.lastInputTokens > 0 && usage.input_tokens < acc.lastInputTokens * 0.7) {
      acc.compactionCount++;
    }
    acc.lastInputTokens = usage.input_tokens;

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
    const contextPercent = Math.round((acc.lastInputTokens / 1_000_000) * 100);

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

    const progress: WorkerProgress = {
      message_count: acc.messageCount, tool_calls: acc.toolCalls,
      files_read: Array.from(acc.filesRead), files_written: Array.from(acc.filesWritten),
      last_action: acc.lastAction, last_action_at: acc.lastActionAt,
      elapsed_minutes: 0,
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
