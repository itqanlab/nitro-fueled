import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
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

// Multiplier used to estimate hypothetical all-Opus cost from actual mixed-model cost.
// Reflects approximate Sonnet-to-Opus price ratio for comparison purposes only.
const OPUS_MULTIPLIER = 1.8;
const CACHE_TTL_MS = 30_000;

export class AnalyticsStore {
  private cacheTs = 0;
  private costCache: AnalyticsCostData | null = null;
  private efficiencyCache: AnalyticsEfficiencyData | null = null;
  private modelsCache: AnalyticsModelsData | null = null;
  private sessionsCache: AnalyticsSessionsData | null = null;
  private buildPromise: Promise<void> | null = null;

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
        .filter((e) => e.isDirectory() && !e.isSymbolicLink() && e.name.startsWith('SESSION_'))
        .map((e) => join(sessionsPath, e.name))
        .sort();
    } catch (err) {
      console.error('[analytics-store] Failed to read sessions directory:', err);
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
    const costPoints = [];
    const effPoints = [];
    const compRows = [];

    for (const dir of sessionDirs) {
      const sessionId = basename(dir);
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
