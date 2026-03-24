import type { FileParser } from './parser.interface.js';
import type { OrchestratorState } from '../events/event-types.js';

export class StateParser implements FileParser<OrchestratorState> {
  public canParse(filePath: string): boolean {
    return filePath.endsWith('orchestrator-state.md');
  }

  public parse(content: string, _filePath: string): OrchestratorState {
    const lines = content.split('\n');

    return {
      loopStatus: this.extractField(lines, 'Loop Status') ?? 'UNKNOWN',
      lastUpdated: this.extractField(lines, 'Last Updated') ?? '',
      sessionStarted: this.extractField(lines, 'Session Started') ?? '',
      configuration: this.extractConfiguration(lines),
      activeWorkers: this.extractActiveWorkers(lines),
      completedTasks: this.extractCompletedTasks(lines),
      failedTasks: this.extractFailedTasks(lines),
      taskQueue: this.extractTaskQueue(lines),
      retryTracker: this.extractRetryTracker(lines),
      sessionLog: this.extractSessionLog(lines),
      compactionCount: this.extractCompactionCount(lines),
    };
  }

  private extractField(lines: ReadonlyArray<string>, field: string): string | undefined {
    for (const line of lines) {
      const match = line.match(new RegExp(`^\\*\\*${field}\\*\\*:\\s*(.+)$`));
      if (match) return match[1].trim();
    }
    return undefined;
  }

  private extractConfiguration(lines: ReadonlyArray<string>): OrchestratorState['configuration'] {
    const section = this.getSection(lines, '## Configuration');
    let concurrencyLimit = 1;
    let monitoringInterval = '5 minutes';
    let retryLimit = 2;

    for (const line of section) {
      const cells = this.parseTableRow(line);
      if (cells.length < 2) continue;

      switch (cells[0]) {
        case 'Concurrency Limit':
          concurrencyLimit = parseInt(cells[1], 10) || 1;
          break;
        case 'Monitoring Interval':
          monitoringInterval = cells[1];
          break;
        case 'Retry Limit':
          retryLimit = parseInt(cells[1], 10) || 2;
          break;
      }
    }

    return { concurrencyLimit, monitoringInterval, retryLimit };
  }

  private extractActiveWorkers(lines: ReadonlyArray<string>): OrchestratorState['activeWorkers'] {
    const section = this.getSection(lines, '## Active Workers');
    const workers: OrchestratorState['activeWorkers'][number][] = [];

    for (const line of section) {
      const cells = this.parseTableRow(line);
      if (cells.length < 9 || cells[0].startsWith('Worker') || cells[0].startsWith('---')) continue;

      workers.push({
        workerId: cells[0],
        taskId: cells[1],
        workerType: cells[2],
        label: cells[3],
        status: cells[4],
        spawnTime: cells[5],
        lastHealth: cells[6],
        stuckCount: parseInt(cells[7], 10) || 0,
        expectedEndState: cells[8],
      });
    }

    return workers;
  }

  private extractCompletedTasks(lines: ReadonlyArray<string>): OrchestratorState['completedTasks'] {
    const section = this.getSection(lines, '## Completed Tasks');
    const tasks: OrchestratorState['completedTasks'][number][] = [];

    for (const line of section) {
      const cells = this.parseTableRow(line);
      if (cells.length < 2 || !cells[0].startsWith('TASK_')) continue;
      tasks.push({ taskId: cells[0], completedAt: cells[1] });
    }

    return tasks;
  }

  private extractFailedTasks(lines: ReadonlyArray<string>): OrchestratorState['failedTasks'] {
    const section = this.getSection(lines, '## Failed Tasks');
    const tasks: OrchestratorState['failedTasks'][number][] = [];

    for (const line of section) {
      const cells = this.parseTableRow(line);
      if (cells.length < 3 || !cells[0].startsWith('TASK_')) continue;
      tasks.push({
        taskId: cells[0],
        reason: cells[1],
        retryCount: parseInt(cells[2], 10) || 0,
      });
    }

    return tasks;
  }

  private extractTaskQueue(lines: ReadonlyArray<string>): OrchestratorState['taskQueue'] {
    const section = this.getSection(lines, '## Task Queue');
    const queue: OrchestratorState['taskQueue'][number][] = [];

    for (const line of section) {
      const cells = this.parseTableRow(line);
      if (cells.length < 4 || !cells[0].startsWith('TASK_')) continue;
      queue.push({
        taskId: cells[0],
        priority: cells[1],
        type: cells[2],
        workerType: cells[3],
      });
    }

    return queue;
  }

  private extractRetryTracker(lines: ReadonlyArray<string>): OrchestratorState['retryTracker'] {
    const section = this.getSection(lines, '## Retry Tracker');
    const tracker: OrchestratorState['retryTracker'][number][] = [];

    for (const line of section) {
      const cells = this.parseTableRow(line);
      if (cells.length < 2 || !cells[0].startsWith('TASK_')) continue;
      tracker.push({
        taskId: cells[0],
        retryCount: parseInt(cells[1], 10) || 0,
      });
    }

    return tracker;
  }

  private extractSessionLog(lines: ReadonlyArray<string>): OrchestratorState['sessionLog'] {
    const section = this.getSection(lines, '## Session Log');
    const log: OrchestratorState['sessionLog'][number][] = [];

    for (const line of section) {
      const cells = this.parseTableRow(line);
      if (cells.length < 2 || cells[0] === 'Timestamp' || cells[0].startsWith('---')) continue;
      log.push({ timestamp: cells[0], event: cells[1] });
    }

    return log;
  }

  private extractCompactionCount(lines: ReadonlyArray<string>): number {
    const field = this.extractField(lines, 'Compaction Count');
    return field !== undefined ? parseInt(field, 10) || 0 : 0;
  }

  private getSection(lines: ReadonlyArray<string>, heading: string): ReadonlyArray<string> {
    const startIdx = lines.findIndex((l) => l.trim() === heading);
    if (startIdx === -1) return [];

    const result: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ') || lines[i].startsWith('**Compaction')) break;
      result.push(lines[i]);
    }
    return result;
  }

  private parseTableRow(line: string): ReadonlyArray<string> {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return [];
    return trimmed.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
  }
}
