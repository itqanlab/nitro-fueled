// @ts-nocheck

import { plainToInstance } from 'class-transformer';

describe('Analytics DTOs - Barrel Exports and Structure', () => {
  it('should export SessionAnalyticsDto from analytics barrel', () => {
    const { SessionAnalyticsDto } = require('../../../dist/app/dtos/responses/analytics/session.dto');
    expect(SessionAnalyticsDto).toBeDefined();
    expect(typeof SessionAnalyticsDto).toBe('function');
  });

  it('should export SessionComparisonRowDto from analytics barrel', () => {
    const { SessionComparisonRowDto } = require('../../../dist/app/dtos/responses/analytics/session.dto');
    expect(SessionComparisonRowDto).toBeDefined();
    expect(typeof SessionComparisonRowDto).toBe('function');
  });

  it('should export SessionCostPointDto from analytics barrel', () => {
    const { SessionCostPointDto } = require('../../../dist/app/dtos/responses/analytics/cost.dto');
    expect(SessionCostPointDto).toBeDefined();
    expect(typeof SessionCostPointDto).toBe('function');
  });

  it('should export AnalyticsCostDataDto from analytics barrel', () => {
    const { AnalyticsCostDataDto } = require('../../../dist/app/dtos/responses/analytics/cost.dto');
    expect(AnalyticsCostDataDto).toBeDefined();
    expect(typeof AnalyticsCostDataDto).toBe('function');
  });

  it('should export EfficiencyPointDto from analytics barrel', () => {
    const { EfficiencyPointDto } = require('../../../dist/app/dtos/responses/analytics/efficiency.dto');
    expect(EfficiencyPointDto).toBeDefined();
    expect(typeof EfficiencyPointDto).toBe('function');
  });

  it('should export AnalyticsEfficiencyDataDto from analytics barrel', () => {
    const { AnalyticsEfficiencyDataDto } = require('../../../dist/app/dtos/responses/analytics/efficiency.dto');
    expect(AnalyticsEfficiencyDataDto).toBeDefined();
    expect(typeof AnalyticsEfficiencyDataDto).toBe('function');
  });

  it('should export ModelUsagePointDto from analytics barrel', () => {
    const { ModelUsagePointDto } = require('../../../dist/app/dtos/responses/analytics/models.dto');
    expect(ModelUsagePointDto).toBeDefined();
    expect(typeof ModelUsagePointDto).toBe('function');
  });

  it('should export AnalyticsModelsDataDto from analytics barrel', () => {
    const { AnalyticsModelsDataDto } = require('../../../dist/app/dtos/responses/analytics/models.dto');
    expect(AnalyticsModelsDataDto).toBeDefined();
    expect(typeof AnalyticsModelsDataDto).toBe('function');
  });

  it('should re-export all analytics DTOs from responses barrel', () => {
    const responsesModule = require('../../../dist/app/dtos/responses');
    expect(responsesModule.SessionAnalyticsDto).toBeDefined();
    expect(responsesModule.SessionComparisonRowDto).toBeDefined();
    expect(responsesModule.SessionCostPointDto).toBeDefined();
    expect(responsesModule.AnalyticsCostDataDto).toBeDefined();
    expect(responsesModule.EfficiencyPointDto).toBeDefined();
    expect(responsesModule.AnalyticsEfficiencyDataDto).toBeDefined();
    expect(responsesModule.ModelUsagePointDto).toBeDefined();
    expect(responsesModule.AnalyticsModelsDataDto).toBeDefined();
  });

  it('should instantiate SessionAnalyticsDto with valid data', () => {
    const { SessionAnalyticsDto } = require('../../../dist/app/dtos/responses/analytics/session.dto');
    const dto = plainToInstance(SessionAnalyticsDto, {
      taskId: 'TASK_2026_001',
      outcome: 'COMPLETE',
      startTime: '2024-01-15T10:00:00.000Z',
      endTime: '2024-01-15T10:45:00.000Z',
      duration: '45m',
      phasesCompleted: ['PM', 'Dev'],
      filesModified: 12,
    });

    expect(dto).toBeDefined();
    expect(dto.taskId).toBe('TASK_2026_001');
    expect(dto.outcome).toBe('COMPLETE');
  });

  it('should handle nullable filesModified property', () => {
    const { SessionAnalyticsDto } = require('../../../dist/app/dtos/responses/analytics/session.dto');
    const dto = plainToInstance(SessionAnalyticsDto, {
      taskId: 'TASK_2026_002',
      outcome: 'FAILED',
      startTime: '2024-01-15T10:00:00.000Z',
      endTime: '2024-01-15T10:15:00.000Z',
      duration: '15m',
      phasesCompleted: ['PM'],
      filesModified: null,
    });

    expect(dto).toBeDefined();
    expect(dto.filesModified).toBeNull();
  });

  it('should instantiate SessionComparisonRowDto with valid data', () => {
    const { SessionComparisonRowDto } = require('../../../dist/app/dtos/responses/analytics/session.dto');
    const dto = plainToInstance(SessionComparisonRowDto, {
      sessionId: 'SESSION_2026-03-15_10-30-00',
      date: '2024-01-15',
      taskCount: 5,
      durationMinutes: 240,
      totalCost: 42.5,
      failureCount: 1,
      avgReviewScore: 8.5,
    });

    expect(dto).toBeDefined();
    expect(dto.sessionId).toBe('SESSION_2026-03-15_10-30-00');
    expect(dto.totalCost).toBe(42.5);
  });

  it('should instantiate SessionCostPointDto with valid data', () => {
    const { SessionCostPointDto } = require('../../../dist/app/dtos/responses/analytics/cost.dto');
    const dto = plainToInstance(SessionCostPointDto, {
      sessionId: 'SESSION_2026-03-15_10-30-00',
      date: '2024-01-15',
      totalCost: 8.5,
      costByModel: { 'claude-sonnet-4': 7.0, 'claude-haiku-4': 1.5 },
      taskCount: 5,
    });

    expect(dto).toBeDefined();
    expect(dto.totalCost).toBe(8.5);
    expect(dto.costByModel).toEqual({ 'claude-sonnet-4': 7.0, 'claude-haiku-4': 1.5 });
  });

  it('should instantiate EfficiencyPointDto with valid data', () => {
    const { EfficiencyPointDto } = require('../../../dist/app/dtos/responses/analytics/efficiency.dto');
    const dto = plainToInstance(EfficiencyPointDto, {
      sessionId: 'SESSION_2026-03-15_10-30-00',
      date: '2024-01-15',
      avgDurationMinutes: 45.5,
      avgTokensPerTask: 250000,
      retryRate: 0.1,
      failureRate: 0.05,
      avgReviewScore: 8.2,
    });

    expect(dto).toBeDefined();
    expect(dto.avgDurationMinutes).toBe(45.5);
    expect(dto.avgReviewScore).toBe(8.2);
  });

  it('should instantiate ModelUsagePointDto with valid data', () => {
    const { ModelUsagePointDto } = require('../../../dist/app/dtos/responses/analytics/models.dto');
    const dto = plainToInstance(ModelUsagePointDto, {
      model: 'claude-sonnet-4-20250514',
      totalCost: 100.0,
      taskCount: 85,
      tokenCount: 4000000,
    });

    expect(dto).toBeDefined();
    expect(dto.model).toBe('claude-sonnet-4-20250514');
    expect(dto.totalCost).toBe(100.0);
  });
});
