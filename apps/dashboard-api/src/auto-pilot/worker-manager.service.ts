/**
 * WorkerManagerService — spawns and monitors worker processes.
 *
 * Adapts the spawn.ts and jsonl-watcher.ts logic from mcp-cortex into a
 * persistent NestJS service. Workers are Claude Code / OpenCode / Codex
 * child processes that run orchestration tasks autonomously.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SupervisorDbService } from './supervisor-db.service';
import type { ProviderType, WorkerType } from './auto-pilot.types';

// ============================================================
// Types
// ============================================================

export interface SpawnWorkerOpts {
  sessionId: string;
  taskId: string;
  workerType: WorkerType;
  prompt: string;
  workingDirectory: string;
  label: string;
  model: string;
  provider: ProviderType;
  retryNumber: number;
  workflowPhase: string;
}

export interface SpawnResult {
  workerId: string;
  pid: number;
  logPath: string;
}

// ============================================================
// Service
// ============================================================

@Injectable()
export class WorkerManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerManagerService.name);
  private readonly childProcesses = new Map<number, ChildProcess>();

  public constructor(private readonly supervisorDb: SupervisorDbService) {}

  public onModuleDestroy(): void {
    // Gracefully terminate all managed child processes on shutdown
    for (const [, child] of this.childProcesses) {
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
    }
    this.childProcesses.clear();
  }

  // ============================================================
  // Spawn
  // ============================================================

  public spawnWorker(opts: SpawnWorkerOpts): SpawnResult {
    const workerId = randomUUID();
    const resolvedDir = resolve(opts.workingDirectory);

    // Resolve GLM API key if needed
    let glmApiKey: string | undefined;
    if (opts.provider === 'glm') {
      glmApiKey = this.resolveGlmApiKey(resolvedDir);
      if (!glmApiKey) {
        throw new Error('GLM API key not found. Set ZAI_API_KEY or configure .nitro-fueled/config.json');
      }
    }

    // Record spawn start time before DB insert for accurate first-output timing
    const spawnStartMs = Date.now();
    let firstOutputRecorded = false;

    // Insert worker row BEFORE spawning (H2 safety: DB row exists if process exits immediately)
    this.supervisorDb.insertWorker({
      workerId,
      sessionId: opts.sessionId,
      taskId: opts.taskId,
      workerType: opts.workerType,
      label: opts.label,
      workingDirectory: resolvedDir,
      model: opts.model,
      provider: opts.provider,
      retryNumber: opts.retryNumber,
      workflowPhase: opts.workflowPhase,
    });

    // Setup log file
    const logDir = join(resolvedDir, '.worker-logs');
    mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeLabel = opts.label.replace(/[^a-zA-Z0-9_-]/g, '_');
    const logPath = join(logDir, `${safeLabel}_${timestamp}.log`);

    // Build spawn command
    const sanitizedPrompt = this.sanitizePromptForProvider(opts.prompt, opts.provider);
    const { binary, args, env } = this.buildSpawnCommand({
      prompt: sanitizedPrompt,
      workingDirectory: resolvedDir,
      model: opts.model,
      provider: opts.provider,
      glmApiKey,
    });

    // Spawn the child process
    const child = spawn(binary, args, {
      cwd: resolvedDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env,
    });

    // Pipe stdout to log file; record first-output timing on first chunk
    child.stdout?.on('data', (chunk: Buffer) => {
      appendFileSync(logPath, chunk);
      if (!firstOutputRecorded) {
        firstOutputRecorded = true;
        this.supervisorDb.updateWorkerFirstOutput(workerId, Date.now() - spawnStartMs);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      appendFileSync(logPath, `[STDERR] ${chunk}`);
    });

    child.on('error', (err) => {
      appendFileSync(logPath, `[ERROR] ${err.message}\n`);
    });

    child.on('exit', (code, signal) => {
      appendFileSync(logPath, `\n[EXIT] code=${code} signal=${signal}\n`);
      const pid = child.pid;
      if (pid !== undefined) this.childProcesses.delete(pid);
      const totalDurationMs = Date.now() - spawnStartMs;
      const newStatus = code === 0 ? 'completed' : 'failed';
      const outcome = code === 0 ? 'COMPLETE' : 'FAILED';
      this.supervisorDb.updateWorkerStatus(workerId, newStatus);
      this.supervisorDb.updateWorkerCompletion(workerId, totalDurationMs, outcome);
      if (code === 0) {
        this.recordFilesChanged(workerId, opts.workingDirectory);
      }
    });

    if (!child.pid) {
      throw new Error(`Failed to spawn '${binary}' process for worker "${opts.label}". Is ${binary} on PATH?`);
    }

    this.childProcesses.set(child.pid, child);

    // Update worker row with PID
    this.supervisorDb.updateWorkerPid(workerId, child.pid, logPath);

    this.logger.log(`Spawned ${opts.workerType} worker ${opts.label} (PID ${child.pid}, provider: ${opts.provider})`);

    return { workerId, pid: child.pid, logPath };
  }

  // ============================================================
  // Kill
  // ============================================================

  public killWorker(pid: number, workerId: string): boolean {
    const child = this.childProcesses.get(pid);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      setTimeout(() => {
        try { if (!child.killed) child.kill('SIGKILL'); } catch { /* dead */ }
      }, 5000);
      this.childProcesses.delete(pid);
      this.supervisorDb.markWorkerKilled(workerId);
      return true;
    }
    // PID not in managed map — mark as killed in DB anyway
    this.supervisorDb.markWorkerKilled(workerId);
    return false;
  }

  // ============================================================
  // Process checks
  // ============================================================

  public isProcessAlive(pid: number): boolean {
    try { process.kill(pid, 0); return true; } catch { return false; }
  }

  public getManagedProcessCount(): number {
    return this.childProcesses.size;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private recordFilesChanged(workerId: string, workingDirectory: string): void {
    try {
      const output = execSync('git diff --name-only HEAD~1 HEAD 2>/dev/null || true', {
        cwd: workingDirectory,
        encoding: 'utf8',
        timeout: 5000,
      });
      const files = output.split('\n').map(f => f.trim()).filter(f => f.length > 0);
      if (files.length > 0) {
        this.supervisorDb.updateWorkerFilesChanged(workerId, files.length, files);
      }
    } catch {
      // best effort — do not throw
    }
  }

  private buildSpawnCommand(opts: {
    prompt: string;
    workingDirectory: string;
    model: string;
    provider: ProviderType;
    glmApiKey?: string;
  }): { binary: string; args: string[]; env: NodeJS.ProcessEnv } {
    switch (opts.provider) {
      case 'claude':
        return {
          binary: 'claude',
          args: [
            '--print', '--dangerously-skip-permissions',
            '--model', opts.model,
            '--output-format', 'stream-json', '--verbose',
            opts.prompt,
          ],
          env: this.buildClaudeEnv(),
        };

      case 'glm':
        return {
          binary: 'claude',
          args: [
            '--print', '--dangerously-skip-permissions',
            '--model', opts.model,
            '--output-format', 'stream-json', '--verbose',
            opts.prompt,
          ],
          env: this.buildGlmEnv(opts.glmApiKey ?? ''),
        };

      case 'opencode':
        return {
          binary: 'opencode',
          args: [
            'run', '--model', opts.model,
            '--format', 'json',
            '--dir', opts.workingDirectory,
            opts.prompt,
          ],
          env: this.buildOpenEnv(),
        };

      case 'codex':
        return {
          binary: 'codex',
          args: [
            'exec', '--model', opts.model,
            '--json', '--dangerously-bypass-approvals-and-sandbox',
            '-C', opts.workingDirectory,
            opts.prompt,
          ],
          env: this.buildOpenEnv(),
        };
    }
  }

  private buildClaudeEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    const allow = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'ANTHROPIC_API_KEY'];
    for (const key of allow) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    return env;
  }

  private buildGlmEnv(apiKey: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
      API_TIMEOUT_MS: '3000000',
    };
  }

  private buildOpenEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    const allow = [
      'PATH', 'HOME', 'USER', 'SHELL', 'TERM',
      'OPENAI_API_KEY', 'OPENCODE_SERVER_PASSWORD',
      'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
    ];
    for (const key of allow) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    return env;
  }

  private resolveGlmApiKey(workingDirectory: string): string | undefined {
    if (process.env['ZAI_API_KEY']) return process.env['ZAI_API_KEY'];
    const configPath = resolve(workingDirectory, '.nitro-fueled', 'config.json');
    if (!existsSync(configPath)) return undefined;
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      const providers = raw['providers'] as Record<string, unknown> | undefined;
      if (!providers) return undefined;
      const glm = providers['glm'] as Record<string, unknown> | undefined;
      if (!glm) return undefined;
      const apiKey = glm['apiKey'] as string | undefined;
      if (!apiKey) return undefined;
      return apiKey.startsWith('$') ? (process.env[apiKey.slice(1)] ?? undefined) : apiKey;
    } catch {
      return undefined;
    }
  }

  private sanitizePromptForProvider(prompt: string, provider: ProviderType): string {
    if (provider === 'claude' || provider === 'glm') return prompt;
    return prompt
      .replaceAll('Agent tool', 'launcher-supported sub-agent tool')
      .replaceAll('Use the Skill tool', 'Read the referenced instructions directly')
      .replaceAll('using the Skill tool', 'by reading the referenced instructions directly');
  }
}
