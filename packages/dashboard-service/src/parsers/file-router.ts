import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { DashboardEventBus } from '../events/event-bus.js';
import type { DashboardEvent } from '../events/event-types.js';
import { StateStore } from '../state/store.js';
import { SessionStore } from '../state/session-store.js';
import { extractSessionId } from '../state/session-id.js';
import { diffRegistry, diffState } from '../state/differ.js';
import { RegistryParser } from './registry.parser.js';
import { PlanParser } from './plan.parser.js';
import { StateParser } from './state.parser.js';
import { TaskParser } from './task.parser.js';
import { ReviewParser } from './review.parser.js';
import { ReportParser } from './report.parser.js';
import { PatternsParser } from './patterns.parser.js';
import { LessonsParser } from './lessons.parser.js';
import { SessionStateParser } from './session-state.parser.js';
import { SessionLogParser } from './session-log.parser.js';
import { ActiveSessionsParser } from './active-sessions.parser.js';

export class FileRouter {
  private readonly registryParser = new RegistryParser();
  private readonly planParser = new PlanParser();
  private readonly stateParser = new StateParser();
  private readonly taskParser = new TaskParser();
  private readonly reviewParser = new ReviewParser();
  private readonly reportParser = new ReportParser();
  private readonly patternsParser = new PatternsParser();
  private readonly lessonsParser = new LessonsParser();
  private readonly sessionStateParser = new SessionStateParser();
  private readonly sessionLogParser = new SessionLogParser();
  private readonly activeSessionsParser = new ActiveSessionsParser();

  // Per-file debounce timers (100ms) to absorb burst writes during active orchestration.
  private readonly debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  public constructor(
    private readonly store: StateStore,
    private readonly sessionStore: SessionStore,
    private readonly eventBus: DashboardEventBus,
  ) {}

  public handleChange(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      void this.loadFile(filePath).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[dashboard-service] Error parsing ${filePath}: ${message}`);
      });
    }, 100);
    this.debounceTimers.set(filePath, timer);
  }

  public handleRemoval(filePath: string): void {
    const taskIdMatch = filePath.match(/TASK_\d{4}_\d{3}/);

    if (taskIdMatch && filePath.endsWith('task.md')) {
      this.store.removeTask(taskIdMatch[0]);
      return;
    }

    if (taskIdMatch && this.reviewParser.canParse(filePath)) {
      // Derive review type from filename (e.g. review-code.md → code)
      const reviewTypeMatch = basename(filePath, '.md').match(/^(?:review-)?(.+)$/);
      if (reviewTypeMatch) {
        this.store.removeReview(taskIdMatch[0], reviewTypeMatch[1]);
      }
      return;
    }

    if (taskIdMatch && filePath.endsWith('completion-report.md')) {
      this.store.removeCompletionReport(taskIdMatch[0]);
      return;
    }

    if (this.sessionStateParser.canParse(filePath)) {
      const sessionId = extractSessionId(filePath);
      if (sessionId) {
        this.sessionStore.removeSession(sessionId);
      }
      return;
    }

    if (this.stateParser.canParse(filePath)) {
      this.store.clearOrchestratorState();
      return;
    }

    if (this.planParser.canParse(filePath)) {
      this.store.clearPlan();
      return;
    }

    if (this.patternsParser.canParse(filePath)) {
      this.store.clearAntiPatterns();
      return;
    }

    if (this.lessonsParser.canParse(filePath)) {
      const domain = basename(filePath, '.md');
      this.store.removeLessons(domain);
      return;
    }
  }

  private async loadFile(filePath: string): Promise<void> {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.debug(`[file-router] file removed before read: ${filePath}`);
        return;
      }
      throw error;
    }

    if (this.registryParser.canParse(filePath)) {
      const newRecords = this.registryParser.parse(content, filePath);
      const oldRecords = this.store.setRegistry(newRecords);
      this.emitEvents(diffRegistry(oldRecords, newRecords));
      return;
    }

    if (this.planParser.canParse(filePath)) {
      const plan = this.planParser.parse(content, filePath);
      this.store.setPlan(plan);
      this.emitEvents([{
        type: 'plan:updated',
        timestamp: new Date().toISOString(),
        payload: { phase: plan.currentFocus.activePhase, change: 'updated' },
      }]);
      return;
    }

    if (this.activeSessionsParser.canParse(filePath)) {
      const records = this.activeSessionsParser.parse(content, filePath);
      const ids = records.map((r) => r.sessionId);
      this.sessionStore.setActiveSessionIds(ids);
      this.emitEvents([{ type: 'sessions:changed', timestamp: new Date().toISOString(), payload: { activeCount: ids.length } }]);
      return;
    }

    if (this.sessionStateParser.canParse(filePath)) {
      const sessionId = extractSessionId(filePath);
      if (sessionId) {
        const state = this.sessionStateParser.parse(content, filePath);
        this.sessionStore.setSessionState(sessionId, state);
        this.emitEvents([{ type: 'session:updated', timestamp: new Date().toISOString(), payload: { sessionId } }]);
      }
      return;
    }

    if (this.sessionLogParser.canParse(filePath)) {
      const sessionId = extractSessionId(filePath);
      if (sessionId) {
        const log = this.sessionLogParser.parse(content, filePath);
        this.sessionStore.setSessionLog(sessionId, log);
        this.emitEvents([{ type: 'session:updated', timestamp: new Date().toISOString(), payload: { sessionId } }]);
      }
      return;
    }

    if (this.stateParser.canParse(filePath)) {
      const newState = this.stateParser.parse(content, filePath);
      const oldState = this.store.setOrchestratorState(newState);
      this.emitEvents(diffState(oldState, newState));
      return;
    }

    if (this.taskParser.canParse(filePath)) {
      const definition = this.taskParser.parse(content, filePath);
      const taskIdMatch = filePath.match(/TASK_\d{4}_\d{3}/);
      if (taskIdMatch) {
        this.store.setTaskDefinition(taskIdMatch[0], definition);
        this.emitEvents([{
          type: 'task:updated',
          timestamp: new Date().toISOString(),
          payload: { taskId: taskIdMatch[0], field: 'definition', oldValue: null, newValue: definition.title },
        }]);
      }
      return;
    }

    if (this.reviewParser.canParse(filePath)) {
      const review = this.reviewParser.parse(content, filePath);
      if (!review.taskId) {
        console.warn(`[file-router] review parsed with empty taskId, skipping store write: ${filePath}`);
        return;
      }
      this.store.addReview(review.taskId, review);
      this.emitEvents([{
        type: 'review:written',
        timestamp: new Date().toISOString(),
        payload: { taskId: review.taskId, reviewType: review.reviewType, findingCount: review.findings.length },
      }]);
      return;
    }

    if (this.reportParser.canParse(filePath)) {
      const report = this.reportParser.parse(content, filePath);
      if (!report.taskId) {
        console.warn(`[file-router] report parsed with empty taskId, skipping store write: ${filePath}`);
        return;
      }
      this.store.setCompletionReport(report.taskId, report);
      return;
    }

    if (this.patternsParser.canParse(filePath)) {
      const patterns = this.patternsParser.parse(content, filePath);
      this.store.setAntiPatterns(patterns);
      return;
    }

    if (this.lessonsParser.canParse(filePath)) {
      const lessons = this.lessonsParser.parse(content, filePath);
      const domain = basename(filePath, '.md');
      this.store.setLessons(domain, lessons);
      return;
    }
  }

  private emitEvents(events: ReadonlyArray<DashboardEvent>): void {
    for (const event of events) {
      this.eventBus.emit(event);
    }
  }
}
