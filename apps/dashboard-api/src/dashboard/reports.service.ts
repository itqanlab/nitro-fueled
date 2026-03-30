import { Injectable } from '@nestjs/common';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseAvgReviewScore, parseCostFromContent, parseSessionIdDate } from './analytics.helpers';
import { CortexService } from './cortex.service';
import type { CortexTask, CortexWorker } from './cortex.types';
import {
  buildCostTrend,
  buildModelCostRows,
  buildModelPerformanceRows,
  buildQualityCategories,
  buildQualityTrend,
  buildRiskAreas,
  buildSessionRow,
  buildSessionTrend,
  buildSuccessRows,
  buildTaskTypeCostRows,
  parseCompactionCount,
  parseMetricValue,
  parseSessionStarted,
  summarizeFastestPhase,
  summarizePrimaryModel,
  summarizeTaskCosts,
  toIsoDate,
  withinRange,
  type ParsedReviewMetric,
  type ParsedSessionMetrics,
} from './reports.helpers';
import type { ReportsOverview } from './reports.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ReportsService {
  public constructor(
    private readonly cortexService: CortexService,
    private readonly projectRoot: string,
  ) {}

  public async getOverview(from: string | null, to: string | null): Promise<ReportsOverview> {
    const safeFrom = from !== null && DATE_RE.test(from) ? from : null;
    const safeTo = to !== null && DATE_RE.test(to) ? to : null;
    const [sessions, reviews] = await Promise.all([this.readSessions(safeFrom, safeTo), this.readReviews(safeFrom, safeTo)]);
    const cortexTasks = this.cortexService.getTasks() ?? [];
    const cortexWorkers = this.cortexService.getWorkers() ?? [];
    const cortexSessions = (this.cortexService.getSessions() ?? []).filter((session) => withinRange(session.started_at.slice(0, 10), safeFrom, safeTo));
    const cortexModelRows = buildModelPerformanceRows((this.cortexService.getModelPerformance() ?? []).filter((row) => row.last_run === null || withinRange(row.last_run.slice(0, 10), safeFrom, safeTo)));
    const primaryModelByTask = summarizePrimaryModel(cortexWorkers);
    const primaryModelBySession = new Map(cortexSessions.map((session) => [session.id, session.supervisor_model]));
    const filteredWorkers = this.filterWorkersByTasks(cortexWorkers, cortexTasks, safeFrom, safeTo);
    const costSummary = summarizeTaskCosts(cortexTasks.filter((task) => withinRange(task.created_at.slice(0, 10), safeFrom, safeTo)), filteredWorkers);
    const successRows = buildSuccessRows(this.buildSuccessDimensions(cortexTasks, primaryModelByTask, safeFrom, safeTo));
    const totalSessionCost = sessions.reduce((sum, session) => sum + session.totalCost, 0);
    const totalSessionDuration = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const totalRetries = sessions.reduce((sum, session) => sum + session.retryCount, 0);
    const totalCompactions = sessions.reduce((sum, session) => sum + session.compactionCount, 0);
    const averageScore = reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length : 0;
    const qualityCategories = buildQualityCategories(reviews);
    const taskTypeRows = buildTaskTypeCostRows(costSummary.byTaskType);
    const modelCostRows = buildModelCostRows(costSummary.byModel);
    const phaseTiming = this.cortexService.getPhaseTiming() ?? [];

    return {
      dateRange: {
        from: safeFrom,
        to: safeTo,
        availableFrom: this.firstDate([sessions.map((session) => session.label), reviews.map((review) => review.observedAt), cortexSessions.map((session) => session.started_at.slice(0, 10))]),
        availableTo: this.lastDate([sessions.map((session) => session.label), reviews.map((review) => review.observedAt), cortexSessions.map((session) => session.started_at.slice(0, 10))]),
      },
      sessionReport: {
        summary: {
          totalSessions: sessions.length,
          completedSessions: sessions.filter((session) => session.failureCount === 0).length,
          failedSessions: sessions.filter((session) => session.failureCount > 0).length,
          totalCost: Number(totalSessionCost.toFixed(4)),
          averageDurationMinutes: sessions.length > 0 ? Number((totalSessionDuration / sessions.length).toFixed(1)) : 0,
          averageRetries: sessions.length > 0 ? Number((totalRetries / sessions.length).toFixed(1)) : 0,
          averageCompactions: sessions.length > 0 ? Number((totalCompactions / sessions.length).toFixed(1)) : 0,
        },
        trend: buildSessionTrend(sessions),
        rows: sessions.map((session) => buildSessionRow(session, primaryModelBySession.get(session.sessionId) ?? 'Unknown')),
        insights: this.buildSessionInsights(sessions),
      },
      successRateReport: {
        summary: {
          overallSuccessRate: successRows.length > 0 ? successRows[0].dimension === 'taskType' ? Number(((successRows.filter((row) => row.dimension === 'taskType').reduce((sum, row) => sum + row.completeCount, 0) / Math.max(successRows.filter((row) => row.dimension === 'taskType').reduce((sum, row) => sum + row.total, 0), 1)) * 100).toFixed(1)) : 0 : 0,
          totalTasks: successRows.filter((row) => row.dimension === 'taskType').reduce((sum, row) => sum + row.total, 0),
          bestTaskType: this.topLabel(successRows, 'taskType'),
          worstComplexity: this.bottomLabel(successRows, 'complexity'),
          bestModel: this.topLabel(successRows, 'model'),
        },
        rows: successRows,
        insights: this.buildSuccessInsights(successRows),
      },
      costAnalysisReport: {
        summary: {
          totalCost: Number(cortexSessions.reduce((sum, session) => sum + session.total_cost, 0).toFixed(4)),
          averageCostPerTask: this.averageCostPerTask(cortexSessions),
          topModel: modelCostRows[0]?.model ?? 'No model data',
          topTaskType: taskTypeRows[0]?.taskType ?? 'No task data',
          optimizationHint: modelCostRows.length > 1 ? `Review ${modelCostRows[0].model} spend against ${modelCostRows[1].model} for cheaper substitutes.` : 'Capture more cortex worker cost data to unlock optimization recommendations.',
        },
        trend: buildCostTrend(cortexSessions),
        modelBreakdown: modelCostRows,
        taskTypeBreakdown: taskTypeRows,
        insights: this.buildCostInsights(modelCostRows, taskTypeRows),
      },
      modelPerformanceReport: {
        summary: {
          bestQualityModel: this.bestModelBy(cortexModelRows, (row) => row.avgReviewScore),
          cheapestModel: this.bestModelBy(cortexModelRows, (row) => row.avgCostUsd === 0 ? Number.POSITIVE_INFINITY : 1 / row.avgCostUsd),
          fastestPhase: summarizeFastestPhase(phaseTiming),
          mostReliableModel: this.bestModelBy(cortexModelRows, (row) => 100 - row.failureRate),
        },
        rows: cortexModelRows,
        insights: this.buildModelInsights(cortexModelRows),
      },
      qualityTrendsReport: {
        summary: {
          averageScore: Number(averageScore.toFixed(2)),
          totalReviews: reviews.length,
          criticalFindings: reviews.reduce((sum, review) => sum + review.criticalIssues, 0),
          topCategory: qualityCategories[0]?.category ?? 'No review data',
        },
        trend: buildQualityTrend(reviews),
        categories: qualityCategories,
        riskAreas: buildRiskAreas(reviews),
        insights: this.buildQualityInsights(reviews, qualityCategories),
      },
    };
  }

  private async readSessions(from: string | null, to: string | null): Promise<ReadonlyArray<ParsedSessionMetrics>> {
    const sessionsPath = join(this.projectRoot, 'task-tracking', 'sessions');
    const entries = await this.safeReadDir(sessionsPath);
    const sessions = await Promise.all(entries.filter((entry) => entry.startsWith('SESSION_')).map(async (entry) => {
      const dir = join(sessionsPath, entry);
      const stateContent = await this.safeReadFile(join(dir, 'state.md'));
      const analyticsContent = await this.safeReadFile(join(dir, 'analytics.md'));
      const combined = `${stateContent}\n${analyticsContent}`.trim();
      if (!combined) return null;
      const startedAt = parseSessionStarted(combined, entry);
      const label = parseSessionIdDate(entry);
      if (!withinRange(label, from, to)) return null;
      const parsed = parseCostFromContent(combined);
      return {
        sessionId: entry,
        startedAt,
        label,
        totalCost: parsed.totalCost,
        taskCount: parsed.taskCount,
        failureCount: parsed.failureCount,
        durationMinutes: parsed.durationMinutes,
        retryCount: parseMetricValue(analyticsContent, 'Total Extra Retries'),
        compactionCount: parseCompactionCount(stateContent),
        avgReviewScore: parseAvgReviewScore(analyticsContent),
      } satisfies ParsedSessionMetrics;
    }));
    return sessions.filter((session): session is ParsedSessionMetrics => session !== null).sort((left, right) => left.label.localeCompare(right.label));
  }

  private async readReviews(from: string | null, to: string | null): Promise<ReadonlyArray<ParsedReviewMetric>> {
    const tasksPath = join(this.projectRoot, 'task-tracking');
    const taskDirs = (await this.safeReadDir(tasksPath)).filter((entry) => entry.startsWith('TASK_'));
    const reviews = await Promise.all(taskDirs.flatMap((taskDir) => ['review-code-style.md', 'review-code-logic.md', 'review-security.md', 'review-style.md', 'review-logic.md'].map(async (fileName) => {
      const filePath = join(tasksPath, taskDir, fileName);
      const content = await this.safeReadFile(filePath);
      if (!content) return null;
      const fileStat = await stat(filePath);
      const observedAt = toIsoDate(fileStat.mtime.toISOString());
      if (!withinRange(observedAt, from, to)) return null;
      const reviewType = fileName.replace('review-', '').replace('.md', '');
      return {
        taskId: taskDir,
        reviewType,
        score: parseMetricValue(content, 'Overall Score'),
        assessment: this.parseAssessment(content),
        criticalIssues: parseMetricValue(content, 'Critical Issues'),
        seriousIssues: parseMetricValue(content, 'Serious Issues'),
        moderateIssues: parseMetricValue(content, 'Moderate Issues') || parseMetricValue(content, 'Minor Issues'),
        category: this.detectCategory(content, reviewType),
        observedAt,
      } satisfies ParsedReviewMetric;
    })));
    return reviews.filter((review): review is ParsedReviewMetric => review !== null);
  }

  private filterWorkersByTasks(workers: ReadonlyArray<CortexWorker>, tasks: ReadonlyArray<CortexTask>, from: string | null, to: string | null): ReadonlyArray<CortexWorker> {
    const allowedTaskIds = new Set(tasks.filter((task) => withinRange(task.created_at.slice(0, 10), from, to)).map((task) => task.id));
    return workers.filter((worker) => allowedTaskIds.has(worker.task_id));
  }

  private buildSuccessDimensions(tasks: ReadonlyArray<CortexTask>, primaryModelByTask: ReadonlyMap<string, string>, from: string | null, to: string | null): Array<{ dimension: 'taskType' | 'complexity' | 'model' | 'period'; label: string; status: string }> {
    const filteredTasks = tasks.filter((task) => withinRange(task.created_at.slice(0, 10), from, to));
    const dimensions: Array<{ dimension: 'taskType' | 'complexity' | 'model' | 'period'; label: string; status: string }> = [];
    for (const task of filteredTasks) {
      dimensions.push({ dimension: 'taskType', label: task.type, status: task.status });
      dimensions.push({ dimension: 'complexity', label: task.complexity, status: task.status });
      dimensions.push({ dimension: 'model', label: primaryModelByTask.get(task.id) ?? 'Unknown', status: task.status });
      dimensions.push({ dimension: 'period', label: task.created_at.slice(0, 7), status: task.status });
    }
    return dimensions;
  }

  private parseAssessment(content: string): string {
    const match = content.match(/\|\s*Assessment\s*\|\s*([^|]+)\|/i);
    return match ? match[1].trim() : 'UNKNOWN';
  }

  private detectCategory(content: string, reviewType: string): string {
    const lowered = content.toLowerCase();
    if (reviewType.includes('security') || lowered.includes('xss') || lowered.includes('injection')) return 'Security';
    if (lowered.includes('signal') || lowered.includes('angular') || lowered.includes('template')) return 'Frontend';
    if (lowered.includes('sqlite') || lowered.includes('transaction') || lowered.includes('db')) return 'Backend';
    if (lowered.includes('type') || lowered.includes('readonly') || lowered.includes('interface')) return 'Type Safety';
    return 'General Review';
  }

  private buildSessionInsights(sessions: ReadonlyArray<ParsedSessionMetrics>): ReadonlyArray<string> {
    if (sessions.length === 0) return ['No session analytics are available for the selected date range.'];
    const priciest = [...sessions].sort((left, right) => right.totalCost - left.totalCost)[0];
    const slowest = [...sessions].sort((left, right) => right.durationMinutes - left.durationMinutes)[0];
    return [
      `${priciest.sessionId} is the most expensive session at $${priciest.totalCost.toFixed(2)}.`,
      `${slowest.sessionId} is the slowest session at ${slowest.durationMinutes} minutes.`,
    ];
  }

  private buildSuccessInsights(rows: ReadonlyArray<{ dimension: string; label: string; successRate: number }>): ReadonlyArray<string> {
    const taskTypes = rows.filter((row) => row.dimension === 'taskType');
    const models = rows.filter((row) => row.dimension === 'model');
    if (taskTypes.length === 0) return ['No task success data is available for the selected range.'];
    const bestTaskType = taskTypes[0];
    const weakestModel = models.length > 0 ? [...models].sort((left, right) => left.successRate - right.successRate)[0] : null;
    return [
      `${bestTaskType.label} tasks are leading with a ${bestTaskType.successRate}% completion rate.`,
      weakestModel ? `${weakestModel.label} has the lowest model success rate and should be reviewed.` : 'Model-level success data is not available yet.',
    ];
  }

  private buildCostInsights(modelRows: ReadonlyArray<{ model: string; totalCost: number }>, taskTypeRows: ReadonlyArray<{ taskType: string; totalCost: number }>): ReadonlyArray<string> {
    if (modelRows.length === 0) return ['No cortex cost data is available for the selected range.'];
    return [
      `${modelRows[0].model} accounts for the highest cost share at $${modelRows[0].totalCost.toFixed(2)}.`,
      taskTypeRows[0] ? `${taskTypeRows[0].taskType} tasks are currently the most expensive workflow category.` : 'Task-type cost data is not available yet.',
    ];
  }

  private buildModelInsights(rows: ReadonlyArray<{ model: string; avgReviewScore: number; failureRate: number }>): ReadonlyArray<string> {
    if (rows.length === 0) return ['No model performance rows are available for the selected range.'];
    const highestQuality = [...rows].sort((left, right) => right.avgReviewScore - left.avgReviewScore)[0];
    const mostReliable = [...rows].sort((left, right) => left.failureRate - right.failureRate)[0];
    return [
      `${highestQuality.model} has the strongest review quality score in the current window.`,
      `${mostReliable.model} is the most reliable model by failure rate.`,
    ];
  }

  private buildQualityInsights(reviews: ReadonlyArray<ParsedReviewMetric>, categories: ReadonlyArray<{ category: string; count: number }>): ReadonlyArray<string> {
    if (reviews.length === 0) return ['No review artifacts are available for the selected range.'];
    const weakReviews = reviews.filter((review) => review.score < 7).length;
    return [
      `${weakReviews} reviews scored below 7/10 and should be used as coaching examples.`,
      categories[0] ? `${categories[0].category} is the most common finding category across recent reviews.` : 'Finding categories are not available yet.',
    ];
  }

  private averageCostPerTask(sessions: ReadonlyArray<{ total_cost: number; tasks_terminal: number }>): number {
    const totalCost = sessions.reduce((sum, session) => sum + session.total_cost, 0);
    const totalTasks = sessions.reduce((sum, session) => sum + session.tasks_terminal, 0);
    return totalTasks > 0 ? Number((totalCost / totalTasks).toFixed(4)) : 0;
  }

  private bestModelBy(rows: ReadonlyArray<{ model: string }>, metric: (row: { model: string } & Record<string, number>) => number): string {
    if (rows.length === 0) return 'No model data';
    let best = rows[0] as { model: string } & Record<string, number>;
    let score = metric(best);
    for (const row of rows.slice(1)) {
      const current = row as { model: string } & Record<string, number>;
      const currentScore = metric(current);
      if (currentScore > score) {
        best = current;
        score = currentScore;
      }
    }
    return best.model;
  }

  private topLabel(rows: ReadonlyArray<{ dimension: string; label: string; successRate: number }>, dimension: string): string {
    const match = rows.find((row) => row.dimension === dimension);
    return match ? match.label : 'No data';
  }

  private bottomLabel(rows: ReadonlyArray<{ dimension: string; label: string; successRate: number }>, dimension: string): string {
    const matches = rows.filter((row) => row.dimension === dimension);
    if (matches.length === 0) return 'No data';
    return [...matches].sort((left, right) => left.successRate - right.successRate)[0].label;
  }

  private firstDate(groups: ReadonlyArray<ReadonlyArray<string>>): string | null {
    const values = groups.flat().filter((value) => DATE_RE.test(value)).sort();
    return values[0] ?? null;
  }

  private lastDate(groups: ReadonlyArray<ReadonlyArray<string>>): string | null {
    const values = groups.flat().filter((value) => DATE_RE.test(value)).sort();
    return values.length > 0 ? values[values.length - 1] : null;
  }

  private async safeReadDir(path: string): Promise<ReadonlyArray<string>> {
    try {
      return await readdir(path);
    } catch {
      return [];
    }
  }

  private async safeReadFile(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return '';
    }
  }
}
