import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AnalyticsCostData,
  AnalyticsEfficiencyData,
  AnalyticsModelsData,
  AnalyticsSessionsData,
  ModelUsagePoint,
  SessionCostPoint,
} from '../events/event-types.js';
import {
  parseCostFromContent,
  parseSessionIdDate,
  parseAvgReviewScore,
  buildSessionCostPoint,
  buildEfficiencyPoint,
  buildComparisonRow,
} from './analytics-helpers.js';

// Opus cost per million tokens (approximate — for hypothetical comparison only)
const OPUS_COST_PER_MTK = 15.0;
const CACHE_TTL_MS = 30_000;

export class AnalyticsStore {
  private cacheTs = 0;
  private costCache: AnalyticsCostData | null = null;
  private efficiencyCache: AnalyticsEfficiencyData | null = null;
  private modelsCache: AnalyticsModelsData | null = null;
  private sessionsCache: AnalyticsSessionsData | null = null;

  public constructor(private readonly projectRoot: string) {}

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
        .filter((e) => e.isDirectory() && e.name.startsWith('SESSION_'))
        .map((e) => join(sessionsPath, e.name))
        .sort();
    } catch {
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
    const estimatedTokens = totalCost > 0 ? (totalCost / OPUS_COST_PER_MTK) * 1_000_000 : 0;
    const hypOpus = (estimatedTokens / 1_000_000) * OPUS_COST_PER_MTK;
    return { models, totalCost, hypotheticalOpusCost: hypOpus, actualSavings: Math.max(0, hypOpus - totalCost) };
  }

  private async aggregateAllSessions(): Promise<{
    costData: AnalyticsCostData;
    efficiencyData: AnalyticsEfficiencyData;
    sessionsData: AnalyticsSessionsData;
  }> {
    const sessionDirs = await this.readSessionDirs();
    const costPoints = [];
    const effPoints = [];
    const compRows = [];

    for (const dir of sessionDirs) {
      const parts = dir.split('/');
      const sessionId = parts[parts.length - 1];
      const date = parseSessionIdDate(sessionId);

      const stateContent = await this.readTextFile(join(dir, 'state.md'));
      const logContent = await this.readTextFile(join(dir, 'log.md'));
      const content = stateContent ?? logContent ?? '';
      if (!content) continue;

      const parsed = parseCostFromContent(content);
      if (parsed.taskCount === 0 && parsed.totalCost === 0) continue;

      const analyticsContent = await this.readTextFile(join(dir, 'analytics.md'));
      const avgReviewScore = parseAvgReviewScore(analyticsContent);

      costPoints.push(buildSessionCostPoint(sessionId, date, parsed));
      effPoints.push(buildEfficiencyPoint(sessionId, date, parsed, avgReviewScore));
      compRows.push(buildComparisonRow(sessionId, date, parsed, avgReviewScore));
    }

    const cumulativeCost = costPoints.reduce((s, p) => s + p.totalCost, 0);
    return {
      costData: { sessions: costPoints, cumulativeCost, hypotheticalOpusCost: cumulativeCost * 1.8 },
      efficiencyData: { sessions: effPoints },
      sessionsData: { sessions: compRows },
    };
  }

  private async buildCaches(): Promise<void> {
    if (this.isCacheValid()) return;
    const { costData, efficiencyData, sessionsData } = await this.aggregateAllSessions();
    this.costCache = costData;
    this.efficiencyCache = efficiencyData;
    this.sessionsCache = sessionsData;
    this.modelsCache = this.buildModelsData(costData.sessions);
    this.cacheTs = Date.now();
  }

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
