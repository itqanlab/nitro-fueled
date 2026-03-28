import { Injectable, Logger } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type {
  AnalyticsCostData,
  AnalyticsEfficiencyData,
  AnalyticsModelsData,
  AnalyticsSessionsData,
  ModelUsagePoint,
  SessionCostPoint,
  EfficiencyPoint,
  SessionComparisonRow,
} from './dashboard.types';

interface ParsedSessionCost {
  readonly totalCost: number;
  readonly costByModel: Record<string, number>;
  readonly taskCount: number;
  readonly durationMinutes: number;
  readonly failureCount: number;
}

// Multiplier used to estimate hypothetical all-Opus cost from actual mixed-model cost.
// Reflects approximate Sonnet-to-Opus price ratio for comparison purposes only.
const OPUS_MULTIPLIER = 1.8;
const CACHE_TTL_MS = 30_000;

/**
 * AnalyticsService provides cost and efficiency analytics.
 * Migrated from dashboard-service/src/state/analytics-store.ts and analytics-helpers.ts.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private cacheTs = 0;
  private costCache: AnalyticsCostData | null = null;
  private efficiencyCache: AnalyticsEfficiencyData | null = null;
  private modelsCache: AnalyticsModelsData | null = null;
  private sessionsCache: AnalyticsSessionsData | null = null;
  private buildPromise: Promise<void> | null = null;

  public constructor(private readonly projectRoot: string) {}

  /**
   * Invalidate the cache to force rebuild.
   */
  public invalidate(): void {
    this.cacheTs = 0;
  }

  private isCacheValid(): boolean {
    return Date.now() - this.cacheTs < CACHE_TTL_MS;
  }

  private async readSessionDirs(): Promise<string[]> {
    const sessionsPath = join(this.projectRoot, 'task-tracking', 'sessions');
    try {
      const entries = await readdir(sessionsPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.isSymbolicLink() && e.name.startsWith('SESSION_'))
        .map((e) => join(sessionsPath, e.name))
        .sort();
    } catch (err) {
      this.logger.error('Failed to read sessions directory:', err);
      return [];
    }
  }

  private async readTextFile(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  // === Analytics Helpers (migrated from analytics-helpers.ts) ===

  private parseCostFromContent(content: string): ParsedSessionCost {
    const costMatch = content.match(/Total Cost[^\$]*\$([0-9,.]+)/i);
    const totalCost = costMatch ? parseFloat(costMatch[1].replace(',', '')) : 0;

    const costByModel: Record<string, number> = {};
    let opusCost = 0;
    for (const m of content.matchAll(/opus[^$\n]*\$([0-9.]+)/gi)) {
      opusCost += parseFloat(m[1]);
    }
    if (opusCost > 0) costByModel['claude-opus-4-6'] = opusCost;

    let sonnetCost = 0;
    for (const m of content.matchAll(/sonnet[^$\n]*\$([0-9.]+)/gi)) {
      sonnetCost += parseFloat(m[1]);
    }
    if (sonnetCost > 0) costByModel['claude-sonnet-4-6'] = sonnetCost;

    // Count tasks by matching registry table rows of the form: | TASK_YYYY_NNN | ... | COMPLETE |
    // This avoids over-counting the word "COMPLETE" which appears multiple times per task in state.md.
    const taskRows = content.match(/\|\s*TASK_\d{4}_\d{3}\s*\|[^\n]*\|\s*COMPLETE\s*\|/g);
    const taskCount = taskRows ? taskRows.length : 0;

    let durationMinutes = 0;
    const durationMatch = content.match(/(\d+)h\s*(\d+)m/);
    if (durationMatch) {
      durationMinutes = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
    } else {
      const minMatch = content.match(/(\d+)m\b/);
      if (minMatch) durationMinutes = parseInt(minMatch[1]);
    }

    const failMatch = content.match(/(\d+)\s+failed/i);
    const failureCount = failMatch ? parseInt(failMatch[1]) : 0;

    return { totalCost, costByModel, taskCount, durationMinutes, failureCount };
  }

  private parseSessionIdDate(sessionId: string): string {
    const m = sessionId.match(/SESSION_(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : sessionId;
  }

  private parseAvgReviewScore(analyticsContent: string | null): number {
    if (!analyticsContent) return 0;
    let sum = 0;
    let count = 0;
    for (const m of analyticsContent.matchAll(/(\d+(?:\.\d+)?)\/10/g)) {
      sum += parseFloat(m[1]);
      count++;
    }
    return count > 0 ? sum / count : 0;
  }

  private buildSessionCostPoint(
    sessionId: string,
    date: string,
    parsed: ParsedSessionCost,
  ): SessionCostPoint {
    return {
      sessionId,
      date,
      totalCost: parsed.totalCost,
      costByModel: parsed.costByModel,
      taskCount: parsed.taskCount,
    };
  }

  private buildEfficiencyPoint(
    sessionId: string,
    date: string,
    parsed: ParsedSessionCost,
    avgReviewScore: number,
  ): EfficiencyPoint {
    return {
      sessionId,
      date,
      avgDurationMinutes:
        parsed.taskCount > 0 ? parsed.durationMinutes / parsed.taskCount : parsed.durationMinutes,
      avgTokensPerTask: 0,
      retryRate: 0,
      failureRate: parsed.taskCount > 0 ? parsed.failureCount / parsed.taskCount : 0,
      avgReviewScore,
    };
  }

  private buildComparisonRow(
    sessionId: string,
    date: string,
    parsed: ParsedSessionCost,
    avgReviewScore: number,
  ): SessionComparisonRow {
    return {
      sessionId,
      date,
      taskCount: parsed.taskCount,
      durationMinutes: parsed.durationMinutes,
      totalCost: parsed.totalCost,
      failureCount: parsed.failureCount,
      avgReviewScore,
    };
  }

  // === Cache Building ===

  private buildModelsData(sessions: ReadonlyArray<SessionCostPoint>): AnalyticsModelsData {
    const modelMap = new Map<string, { cost: number; tasks: number }>();
    for (const p of sessions) {
      for (const [model, cost] of Object.entries(p.costByModel)) {
        const existing = modelMap.get(model) ?? { cost: 0, tasks: 0 };
        modelMap.set(model, { cost: existing.cost + cost, tasks: existing.tasks + p.taskCount });
      }
    }
    const models: ModelUsagePoint[] = Array.from(modelMap.entries()).map(([model, d]) => ({
      model,
      totalCost: d.cost,
      taskCount: d.tasks,
      tokenCount: 0,
    }));
    const totalCost = models.reduce((s, m) => s + m.totalCost, 0);
    const hypotheticalOpusCost = totalCost * OPUS_MULTIPLIER;
    const actualSavings = Math.max(0, hypotheticalOpusCost - totalCost);
    return { models, totalCost, hypotheticalOpusCost, actualSavings };
  }

  private async aggregateAllSessions(): Promise<{
    costData: AnalyticsCostData;
    efficiencyData: AnalyticsEfficiencyData;
    sessionsData: AnalyticsSessionsData;
  }> {
    const sessionDirs = await this.readSessionDirs();
    const costPoints: SessionCostPoint[] = [];
    const effPoints: EfficiencyPoint[] = [];
    const compRows: SessionComparisonRow[] = [];

    for (const dir of sessionDirs) {
      const sessionId = basename(dir);
      const date = this.parseSessionIdDate(sessionId);

      const stateContent = await this.readTextFile(join(dir, 'state.md'));
      const logContent = await this.readTextFile(join(dir, 'log.md'));
      const content = stateContent ?? logContent ?? '';
      if (!content) continue;

      const parsed = this.parseCostFromContent(content);
      if (parsed.taskCount === 0 && parsed.totalCost === 0) continue;

      const analyticsContent = await this.readTextFile(join(dir, 'analytics.md'));
      const avgReviewScore = this.parseAvgReviewScore(analyticsContent);

      costPoints.push(this.buildSessionCostPoint(sessionId, date, parsed));
      effPoints.push(this.buildEfficiencyPoint(sessionId, date, parsed, avgReviewScore));
      compRows.push(this.buildComparisonRow(sessionId, date, parsed, avgReviewScore));
    }

    const cumulativeCost = costPoints.reduce((s, p) => s + p.totalCost, 0);
    return {
      costData: { sessions: costPoints, cumulativeCost, hypotheticalOpusCost: cumulativeCost * OPUS_MULTIPLIER },
      efficiencyData: { sessions: effPoints },
      sessionsData: { sessions: compRows },
    };
  }

  private async _doBuildCaches(): Promise<void> {
    const { costData, efficiencyData, sessionsData } = await this.aggregateAllSessions();
    this.costCache = costData;
    this.efficiencyCache = efficiencyData;
    this.sessionsCache = sessionsData;
    this.modelsCache = this.buildModelsData(costData.sessions);
    this.cacheTs = Date.now();
  }

  private async buildCaches(): Promise<void> {
    if (this.isCacheValid()) return;
    if (this.buildPromise) return this.buildPromise;
    this.buildPromise = this._doBuildCaches().finally(() => {
      this.buildPromise = null;
    });
    return this.buildPromise;
  }

  // === Public API ===

  public async getCostData(): Promise<AnalyticsCostData> {
    await this.buildCaches();
    return this.costCache ?? { sessions: [], cumulativeCost: 0, hypotheticalOpusCost: 0 };
  }

  public async getEfficiencyData(): Promise<AnalyticsEfficiencyData> {
    await this.buildCaches();
    return this.efficiencyCache ?? { sessions: [] };
  }

  public async getModelsData(): Promise<AnalyticsModelsData> {
    await this.buildCaches();
    return this.modelsCache ?? { models: [], totalCost: 0, hypotheticalOpusCost: 0, actualSavings: 0 };
  }

  public async getSessionsData(): Promise<AnalyticsSessionsData> {
    await this.buildCaches();
    return this.sessionsCache ?? { sessions: [] };
  }
}
