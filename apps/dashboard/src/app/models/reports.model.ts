export interface ReportsDateRange {
  readonly from: string | null;
  readonly to: string | null;
  readonly availableFrom: string | null;
  readonly availableTo: string | null;
}

export interface SessionReportRow {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly durationMinutes: number;
  readonly totalCost: number;
  readonly primaryModel: string;
  readonly retryCount: number;
  readonly compactionCount: number;
  readonly workerEfficiency: number;
}

export interface SessionTrendPoint {
  readonly label: string;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly totalCost: number;
  readonly durationMinutes: number;
}

export interface SessionReport {
  readonly summary: {
    readonly totalSessions: number;
    readonly completedSessions: number;
    readonly failedSessions: number;
    readonly totalCost: number;
    readonly averageDurationMinutes: number;
    readonly averageRetries: number;
    readonly averageCompactions: number;
  };
  readonly trend: ReadonlyArray<SessionTrendPoint>;
  readonly rows: ReadonlyArray<SessionReportRow>;
  readonly insights: ReadonlyArray<string>;
}

export interface SuccessRateRow {
  readonly dimension: 'taskType' | 'complexity' | 'model' | 'period';
  readonly label: string;
  readonly total: number;
  readonly completeCount: number;
  readonly failureCount: number;
  readonly blockedCount: number;
  readonly successRate: number;
}

export interface SuccessRateReport {
  readonly summary: {
    readonly overallSuccessRate: number;
    readonly totalTasks: number;
    readonly bestTaskType: string;
    readonly worstComplexity: string;
    readonly bestModel: string;
  };
  readonly rows: ReadonlyArray<SuccessRateRow>;
  readonly insights: ReadonlyArray<string>;
}

export interface CostTrendPoint {
  readonly label: string;
  readonly cost: number;
  readonly taskCount: number;
}

export interface ModelCostRow {
  readonly model: string;
  readonly totalCost: number;
  readonly sharePercent: number;
  readonly taskCount: number;
}

export interface TaskTypeCostRow {
  readonly taskType: string;
  readonly totalCost: number;
  readonly taskCount: number;
  readonly avgCostPerTask: number;
}

export interface CostAnalysisReport {
  readonly summary: {
    readonly totalCost: number;
    readonly averageCostPerTask: number;
    readonly topModel: string;
    readonly topTaskType: string;
    readonly optimizationHint: string;
  };
  readonly trend: ReadonlyArray<CostTrendPoint>;
  readonly modelBreakdown: ReadonlyArray<ModelCostRow>;
  readonly taskTypeBreakdown: ReadonlyArray<TaskTypeCostRow>;
  readonly insights: ReadonlyArray<string>;
}

export interface ModelPerformanceReportRow {
  readonly model: string;
  readonly taskType: string;
  readonly complexity: string;
  readonly avgReviewScore: number;
  readonly failureRate: number;
  readonly avgDurationMinutes: number;
  readonly avgCostUsd: number;
  readonly qualityPerDollar: number;
  readonly phaseCount: number;
  readonly reviewCount: number;
  readonly lastRun: string;
}

export interface ModelPerformanceReport {
  readonly summary: {
    readonly bestQualityModel: string;
    readonly cheapestModel: string;
    readonly fastestPhase: string;
    readonly mostReliableModel: string;
  };
  readonly rows: ReadonlyArray<ModelPerformanceReportRow>;
  readonly insights: ReadonlyArray<string>;
}

export interface QualityTrendPoint {
  readonly label: string;
  readonly avgScore: number;
  readonly reviewCount: number;
}

export interface QualityCategoryRow {
  readonly category: string;
  readonly count: number;
  readonly severity: 'critical' | 'serious' | 'moderate';
}

export interface RiskAreaRow {
  readonly label: string;
  readonly count: number;
  readonly note: string;
}

export interface QualityTrendsReport {
  readonly summary: {
    readonly averageScore: number;
    readonly totalReviews: number;
    readonly criticalFindings: number;
    readonly topCategory: string;
  };
  readonly trend: ReadonlyArray<QualityTrendPoint>;
  readonly categories: ReadonlyArray<QualityCategoryRow>;
  readonly riskAreas: ReadonlyArray<RiskAreaRow>;
  readonly insights: ReadonlyArray<string>;
}

export interface ReportsOverview {
  readonly dateRange: ReportsDateRange;
  readonly sessionReport: SessionReport;
  readonly successRateReport: SuccessRateReport;
  readonly costAnalysisReport: CostAnalysisReport;
  readonly modelPerformanceReport: ModelPerformanceReport;
  readonly qualityTrendsReport: QualityTrendsReport;
}

export const EMPTY_REPORTS_OVERVIEW: ReportsOverview = {
  dateRange: { from: null, to: null, availableFrom: null, availableTo: null },
  sessionReport: {
    summary: { totalSessions: 0, completedSessions: 0, failedSessions: 0, totalCost: 0, averageDurationMinutes: 0, averageRetries: 0, averageCompactions: 0 },
    trend: [],
    rows: [],
    insights: [],
  },
  successRateReport: {
    summary: { overallSuccessRate: 0, totalTasks: 0, bestTaskType: 'No data', worstComplexity: 'No data', bestModel: 'No data' },
    rows: [],
    insights: [],
  },
  costAnalysisReport: {
    summary: { totalCost: 0, averageCostPerTask: 0, topModel: 'No data', topTaskType: 'No data', optimizationHint: 'No data' },
    trend: [],
    modelBreakdown: [],
    taskTypeBreakdown: [],
    insights: [],
  },
  modelPerformanceReport: {
    summary: { bestQualityModel: 'No data', cheapestModel: 'No data', fastestPhase: 'No data', mostReliableModel: 'No data' },
    rows: [],
    insights: [],
  },
  qualityTrendsReport: {
    summary: { averageScore: 0, totalReviews: 0, criticalFindings: 0, topCategory: 'No data' },
    trend: [],
    categories: [],
    riskAreas: [],
    insights: [],
  },
};
