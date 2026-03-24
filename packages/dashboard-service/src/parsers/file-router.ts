import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import type { DashboardEventBus } from '../events/event-bus.js';
import type { DashboardEvent } from '../events/event-types.js';
import { StateStore } from '../state/store.js';
import { diffRegistry, diffState } from '../state/differ.js';
import { RegistryParser } from './registry.parser.js';
import { PlanParser } from './plan.parser.js';
import { StateParser } from './state.parser.js';
import { TaskParser } from './task.parser.js';
import { ReviewParser } from './review.parser.js';
import { ReportParser } from './report.parser.js';
import { PatternsParser } from './patterns.parser.js';
import { LessonsParser } from './lessons.parser.js';

export class FileRouter {
  private readonly registryParser = new RegistryParser();
  private readonly planParser = new PlanParser();
  private readonly stateParser = new StateParser();
  private readonly taskParser = new TaskParser();
  private readonly reviewParser = new ReviewParser();
  private readonly reportParser = new ReportParser();
  private readonly patternsParser = new PatternsParser();
  private readonly lessonsParser = new LessonsParser();

  public constructor(
    private readonly store: StateStore,
    private readonly eventBus: DashboardEventBus,
  ) {}

  public handleChange(filePath: string): void {
    try {
      this.loadFile(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[dashboard-service] Error parsing ${filePath}: ${message}`);
    }
  }

  public handleRemoval(filePath: string): void {
    const taskIdMatch = filePath.match(/TASK_\d{4}_\d{3}/);
    if (taskIdMatch && filePath.endsWith('task.md')) {
      this.store.removeTask(taskIdMatch[0]);
    }
  }

  private loadFile(filePath: string): void {
    if (!existsSync(filePath)) return;

    const content = readFileSync(filePath, 'utf-8');

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
