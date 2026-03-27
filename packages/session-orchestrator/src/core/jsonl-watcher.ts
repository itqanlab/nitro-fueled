import { watch } from 'chokidar';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  JsonlMessage,
  JsonlAssistantMessage,
  JsonlContentBlock,
  SessionMeta,
  Worker,
} from '../types.js';
import { calculateCost } from './token-calculator.js';
import { isProcessAlive, killProcess, closeItermSession } from './iterm-launcher.js';
import { killPrintProcess } from './print-launcher.js';
import { killOpenCodeProcess, getOpenCodeExitCode } from './opencode-launcher.js';
import type { WorkerRegistry } from './worker-registry.js';

interface SessionAccumulator {
  linesRead: number;
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
  private watcher: ReturnType<typeof watch> | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private registry: WorkerRegistry) {}

  start(): void {
    // Poll every 3 seconds to update stats from JSONL files
    this.pollInterval = setInterval(() => this.pollAll(), 3000);
  }

  stop(): void {
    this.watcher?.close();
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private pollAll(): void {
    const workers = this.registry.list('active');
    for (const worker of workers) {
      // Check if process is still alive
      if (!isProcessAlive(worker.pid)) {
        // For iTerm workers, do a final read of JSONL before marking completed
        if (worker.launcher === 'iterm' && worker.jsonl_path && existsSync(worker.jsonl_path)) {
          const acc = this.getOrCreateAccumulator(worker.session_id, worker.model);
          this.readNewLines(worker.jsonl_path, worker.session_id, acc);
          this.pushStatsToRegistry(worker.worker_id, acc);
        }
        // Print-mode workers already have stats fed via feedMessage — just push final stats
        if (worker.launcher === 'print') {
          const acc = this.accumulators.get(worker.session_id);
          if (acc) {
            this.pushStatsToRegistry(worker.worker_id, acc);
          }
        }
        // OpenCode: push final stats and mark failed on non-zero exit
        if (worker.launcher === 'opencode') {
          const acc = this.accumulators.get(worker.session_id);
          if (acc) {
            this.pushStatsToRegistry(worker.worker_id, acc);
          }
          const exitCode = getOpenCodeExitCode(worker.pid);
          if (exitCode !== null && exitCode !== 0) {
            this.registry.updateStatus(worker.worker_id, 'failed');
            this.accumulators.delete(worker.session_id);
            continue;
          }
        }
        this.registry.updateStatus(worker.worker_id, 'completed');
        this.accumulators.delete(worker.session_id);
        // Close iTerm pane for auto_close workers whose process died
        if (worker.auto_close && worker.launcher === 'iterm') {
          closeItermSession(worker.iterm_session_id).catch(() => {});
        }
        continue;
      }

      // Print-mode and OpenCode workers get stats via feedMessage — skip JSONL polling for them
      if (worker.launcher === 'print' || worker.launcher === 'opencode') {
        const acc = this.accumulators.get(worker.session_id);
        if (acc && worker.auto_close && acc.endTurnAt && !acc.autoCloseTriggered && Date.now() - acc.endTurnAt > 10_000) {
          acc.autoCloseTriggered = true;
          this.autoCloseWorker(worker).catch((err) => {
            console.error(`[auto-close] Failed for ${worker.label}:`, err);
            acc.autoCloseTriggered = false;
          });
        }
        continue;
      }

      // iTerm workers: poll JSONL files
      // Skip workers whose session/JSONL hasn't been resolved yet
      if (worker.session_id === 'pending' || !worker.jsonl_path) continue;
      if (!existsSync(worker.jsonl_path)) continue;

      const acc = this.getOrCreateAccumulator(worker.session_id, worker.model);
      this.readNewLines(worker.jsonl_path, worker.session_id, acc);
      this.pushStatsToRegistry(worker.worker_id, acc);

      // Auto-close: if completion detected and idle for 10s+, kill process and close pane
      if (worker.auto_close && acc.endTurnAt && !acc.autoCloseTriggered && Date.now() - acc.endTurnAt > 10_000) {
        acc.autoCloseTriggered = true;
        this.autoCloseWorker(worker).catch((err) => {
          console.error(`[auto-close] Failed for ${worker.label}:`, err);
          acc.autoCloseTriggered = false; // Allow retry on failure
        });
      }
    }
  }

  private async autoCloseWorker(worker: Worker): Promise<void> {
    if (worker.launcher === 'iterm') {
      await killProcess(worker.pid);
      await closeItermSession(worker.iterm_session_id);
    } else if (worker.launcher === 'opencode') {
      killOpenCodeProcess(worker.pid);
    } else {
      killPrintProcess(worker.pid);
    }
    this.registry.updateStatus(worker.worker_id, 'completed');
  }

  private getOrCreateAccumulator(sessionId: string, model: string): SessionAccumulator {
    let acc = this.accumulators.get(sessionId);
    if (!acc) {
      acc = {
        linesRead: 0,
        totalInput: 0,
        totalOutput: 0,
        totalCacheCreation: 0,
        totalCacheRead: 0,
        lastInputTokens: 0,
        compactionCount: 0,
        messageCount: 0,
        toolCalls: 0,
        filesRead: new Set(),
        filesWritten: new Set(),
        lastAction: 'spawned',
        lastActionAt: Date.now(),
        model,
        endTurnAt: null,
        autoCloseTriggered: false,
      };
      this.accumulators.set(sessionId, acc);
    }
    return acc;
  }

  private readNewLines(jsonlPath: string, sessionId: string, acc: SessionAccumulator): void {
    const content = readFileSync(jsonlPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    // Only process new lines
    for (let i = acc.linesRead; i < lines.length; i++) {
      try {
        const msg: JsonlMessage = JSON.parse(lines[i]);
        this.processMessage(msg, acc);
      } catch {
        // Skip malformed lines
      }
    }
    acc.linesRead = lines.length;
  }

  private processMessage(msg: JsonlMessage, acc: SessionAccumulator): void {
    // "last-prompt" is written when Claude finishes and returns to interactive prompt
    // This is the most reliable completion signal
    if (msg.type === 'last-prompt') {
      if (!acc.endTurnAt) {
        acc.endTurnAt = Date.now();
      }
      return;
    }

    // "result" is the final message from stream-json output — signals session end
    // It contains authoritative cumulative token totals (stream-json assistant messages
    // can have placeholder output_tokens values, so result is the source of truth)
    if (msg.type === 'result') {
      const resultMsg = msg as Record<string, unknown>;
      const usage = resultMsg.usage as Record<string, number> | undefined;
      if (usage) {
        acc.totalInput = usage.input_tokens ?? acc.totalInput;
        acc.totalOutput = usage.output_tokens ?? acc.totalOutput;
        acc.totalCacheCreation = usage.cache_creation_input_tokens ?? acc.totalCacheCreation;
        acc.totalCacheRead = usage.cache_read_input_tokens ?? acc.totalCacheRead;
      }
      if (!acc.endTurnAt) {
        acc.endTurnAt = Date.now();
      }
      return;
    }

    if (msg.type === 'assistant') {
      const assistant = msg as JsonlAssistantMessage;
      if (!assistant.message?.usage) return;
      const usage = assistant.message.usage;

      // Token accumulation
      acc.totalInput += usage.input_tokens;
      acc.totalOutput += usage.output_tokens;
      acc.totalCacheCreation += usage.cache_creation_input_tokens ?? 0;
      acc.totalCacheRead += usage.cache_read_input_tokens ?? 0;
      acc.messageCount++;

      // Compaction detection: input tokens dropped significantly
      if (acc.lastInputTokens > 0 && usage.input_tokens < acc.lastInputTokens * 0.7) {
        acc.compactionCount++;
      }
      acc.lastInputTokens = usage.input_tokens;

      // Track tool calls and file operations
      const hasToolUse = assistant.message.content?.some((b) => b.type === 'tool_use');
      if (assistant.message.content) {
        this.extractToolCalls(assistant.message.content, acc);
      }

      // Track end_turn: task is done when stop_reason is end_turn and no tool calls
      if (assistant.message.stop_reason === 'end_turn' && !hasToolUse) {
        acc.endTurnAt = Date.now();
      } else if (hasToolUse) {
        // Still working (tool calls pending) — reset completion
        acc.endTurnAt = null;
        acc.autoCloseTriggered = false;
      }
    }
  }

  private extractToolCalls(content: JsonlContentBlock[], acc: SessionAccumulator): void {
    for (const block of content) {
      if (block.type === 'tool_use') {
        acc.toolCalls++;
        acc.lastActionAt = Date.now();

        const name = block.name ?? '';
        const input = block.input as Record<string, string> | undefined;

        if (name === 'Read' && input?.file_path) {
          acc.filesRead.add(input.file_path);
          acc.lastAction = `Read(${shortenPath(input.file_path)})`;
        } else if ((name === 'Write' || name === 'Edit') && input?.file_path) {
          acc.filesWritten.add(input.file_path);
          acc.lastAction = `${name}(${shortenPath(input.file_path)})`;
        } else if (name === 'Bash' && input?.command) {
          acc.lastAction = `Bash(${input.command.substring(0, 60)})`;
        } else if (name === 'Agent') {
          const desc = (input?.description ?? input?.prompt ?? '').substring(0, 60);
          acc.lastAction = `Agent(${desc})`;
        } else {
          acc.lastAction = `${name}(...)`;
        }
      }
    }
  }

  /**
   * Feed a parsed stream-json message directly for a print-mode worker.
   * Called from the stdout parser in print-launcher instead of reading JSONL files.
   */
  public feedMessage(workerId: string, msg: JsonlMessage): void {
    const worker = this.registry.get(workerId);
    if (!worker) return;

    const acc = this.getOrCreateAccumulator(worker.session_id, worker.model);
    this.processMessage(msg, acc);
    this.pushStatsToRegistry(workerId, acc);
  }

  private pushStatsToRegistry(workerId: string, acc: SessionAccumulator): void {
    const totalCombined = acc.totalInput + acc.totalOutput + acc.totalCacheCreation + acc.totalCacheRead;
    // Rough context estimate: last input_tokens ≈ current context
    const contextK = Math.round(acc.lastInputTokens / 1000);
    const contextPercent = Math.round((acc.lastInputTokens / 1_000_000) * 100);

    this.registry.updateTokens(workerId, {
      total_input: acc.totalInput,
      total_output: acc.totalOutput,
      total_cache_creation: acc.totalCacheCreation,
      total_cache_read: acc.totalCacheRead,
      total_combined: totalCombined,
      context_current_k: contextK,
      context_percent: contextPercent,
      compaction_count: acc.compactionCount,
    });

    this.registry.updateCost(
      workerId,
      calculateCost(acc.totalInput, acc.totalOutput, acc.totalCacheCreation, acc.totalCacheRead, acc.model),
    );

    const worker = this.registry.get(workerId);
    const elapsed = worker ? Math.round((Date.now() - worker.started_at) / 60000) : 0;

    this.registry.updateProgress(workerId, {
      message_count: acc.messageCount,
      tool_calls: acc.toolCalls,
      files_read: Array.from(acc.filesRead),
      files_written: Array.from(acc.filesWritten),
      last_action: acc.lastAction,
      last_action_at: acc.lastActionAt,
      elapsed_minutes: elapsed,
    });
  }
}

// Resolve session ID from PID
export function resolveSessionId(pid: number): string | null {
  const sessionFile = join(homedir(), '.claude', 'sessions', `${pid}.json`);
  if (!existsSync(sessionFile)) return null;
  const parsed: unknown = JSON.parse(readFileSync(sessionFile, 'utf-8'));
  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as Record<string, unknown>).sessionId !== 'string') return null;
  return (parsed as SessionMeta).sessionId;
}

// Resolve JSONL path from session ID and working directory
export function resolveJsonlPath(sessionId: string, workingDirectory: string): string | null {
  if (sessionId.includes('/') || sessionId.includes('\\')) return null;
  const projectHash = workingDirectory.replace(/\//g, '-').replace(/^-/, '');
  const jsonlPath = join(homedir(), '.claude', 'projects', projectHash, `${sessionId}.jsonl`);
  if (existsSync(jsonlPath)) return jsonlPath;

  // Fallback: search all project dirs for this session ID
  const projectsDir = join(homedir(), '.claude', 'projects');
  if (!existsSync(projectsDir)) return null;

  for (const dir of readdirSync(projectsDir)) {
    const candidate = join(projectsDir, dir, `${sessionId}.jsonl`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function shortenPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return `.../${parts.slice(-2).join('/')}`;
}
