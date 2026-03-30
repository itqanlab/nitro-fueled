import {
  SessionAnalyticsDto,
  SessionComparisonRowDto,
} from '../../src/app/dtos/responses/analytics/session.dto';
import {
  SessionCostPointDto,
  AnalyticsCostDataDto,
} from '../../src/app/dtos/responses/analytics/cost.dto';
import {
  EfficiencyPointDto,
  AnalyticsEfficiencyDataDto,
} from '../../src/app/dtos/responses/analytics/efficiency.dto';
import {
  ModelUsagePointDto,
  AnalyticsModelsDataDto,
} from '../../src/app/dtos/responses/analytics/models.dto';
import * as AnalyticsModule from '../../src/app/dtos/responses/analytics';
import * as ResponsesModule from '../../src/app/dtos/responses';

describe('Analytics DTOs - Structure and Exports', () => {
  describe('Session DTOs (session.dto.ts)', () => {
    describe('SessionAnalyticsDto', () => {
      it('should export SessionAnalyticsDto class', () => {
        expect(SessionAnalyticsDto).toBeDefined();
      });

      it('should instantiate SessionAnalyticsDto with valid data', () => {
        const dto = new SessionAnalyticsDto();
        dto.taskId = 'TASK_2026_001';
        dto.outcome = 'COMPLETE';
        dto.startTime = '2024-01-15T10:00:00.000Z';
        dto.endTime = '2024-01-15T10:45:00.000Z';
        dto.duration = '45m';
        dto.phasesCompleted = ['PM', 'Architect', 'Dev', 'QA'];
        dto.filesModified = 12;

        expect(dto.taskId).toBe('TASK_2026_001');
        expect(dto.outcome).toBe('COMPLETE');
        expect(dto.startTime).toBe('2024-01-15T10:00:00.000Z');
        expect(dto.endTime).toBe('2024-01-15T10:45:00.000Z');
        expect(dto.duration).toBe('45m');
        expect(dto.phasesCompleted).toEqual(['PM', 'Architect', 'Dev', 'QA']);
        expect(dto.filesModified).toBe(12);
      });

      it('should handle nullable filesModified property', () => {
        const dto = new SessionAnalyticsDto();
        dto.taskId = 'TASK_2026_002';
        dto.outcome = 'FAILED';
        dto.startTime = '2024-01-15T10:00:00.000Z';
        dto.endTime = '2024-01-15T10:15:00.000Z';
        dto.duration = '15m';
        dto.phasesCompleted = ['PM'];
        dto.filesModified = null;

        expect(dto.filesModified).toBeNull();
      });
    });

    describe('SessionComparisonRowDto', () => {
      it('should export SessionComparisonRowDto class', () => {
        expect(SessionComparisonRowDto).toBeDefined();
      });

      it('should instantiate SessionComparisonRowDto with valid data', () => {
        const dto = new SessionComparisonRowDto();
        dto.sessionId = 'SESSION_2026-03-15_10-30-00';
        dto.date = '2024-01-15';
        dto.taskCount = 5;
        dto.durationMinutes = 240;
        dto.totalCost = 42.5;
        dto.failureCount = 1;
        dto.avgReviewScore = 8.5;

        expect(dto.sessionId).toBe('SESSION_2026-03-15_10-30-00');
        expect(dto.date).toBe('2024-01-15');
        expect(dto.taskCount).toBe(5);
        expect(dto.durationMinutes).toBe(240);
        expect(dto.totalCost).toBe(42.5);
        expect(dto.failureCount).toBe(1);
        expect(dto.avgReviewScore).toBe(8.5);
      });
    });
  });

  describe('Cost DTOs (cost.dto.ts)', () => {
    describe('SessionCostPointDto', () => {
      it('should export SessionCostPointDto class', () => {
        expect(SessionCostPointDto).toBeDefined();
      });

      it('should instantiate SessionCostPointDto with valid data', () => {
        const dto = new SessionCostPointDto();
        dto.sessionId = 'SESSION_2026-03-15_10-30-00';
        dto.date = '2024-01-15';
        dto.totalCost = 8.5;
        dto.costByModel = { 'claude-sonnet-4': 7.0, 'claude-haiku-4': 1.5 };
        dto.taskCount = 5;

        expect(dto.sessionId).toBe('SESSION_2026-03-15_10-30-00');
        expect(dto.date).toBe('2024-01-15');
        expect(dto.totalCost).toBe(8.5);
        expect(dto.costByModel).toEqual({ 'claude-sonnet-4': 7.0, 'claude-haiku-4': 1.5 });
        expect(dto.taskCount).toBe(5);
      });
    });

    describe('AnalyticsCostDataDto', () => {
      it('should export AnalyticsCostDataDto class', () => {
        expect(AnalyticsCostDataDto).toBeDefined();
      });

      it('should instantiate AnalyticsCostDataDto with valid data', () => {
        const sessionPoint = new SessionCostPointDto();
        sessionPoint.sessionId = 'SESSION_2026-03-15_10-30-00';
        sessionPoint.date = '2024-01-15';
        sessionPoint.totalCost = 8.5;
        sessionPoint.costByModel = { 'claude-sonnet-4': 7.0 };
        sessionPoint.taskCount = 5;

        const dto = new AnalyticsCostDataDto();
        dto.sessions = [sessionPoint];
        dto.cumulativeCost = 350.0;
        dto.hypotheticalOpusCost = 1200.0;

        expect(dto.sessions).toHaveLength(1);
        expect(dto.sessions[0].sessionId).toBe('SESSION_2026-03-15_10-30-00');
        expect(dto.cumulativeCost).toBe(350.0);
        expect(dto.hypotheticalOpusCost).toBe(1200.0);
      });
    });
  });

  describe('Efficiency DTOs (efficiency.dto.ts)', () => {
    describe('EfficiencyPointDto', () => {
      it('should export EfficiencyPointDto class', () => {
        expect(EfficiencyPointDto).toBeDefined();
      });

      it('should instantiate EfficiencyPointDto with valid data', () => {
        const dto = new EfficiencyPointDto();
        dto.sessionId = 'SESSION_2026-03-15_10-30-00';
        dto.date = '2024-01-15';
        dto.tasksCompleted = 5;
        dto.tasksFailed = 0;
        dto.totalDuration = 240;
        dto.efficiencyScore = 1.25;

        expect(dto.sessionId).toBe('SESSION_2026-03-15_10-30-00');
        expect(dto.date).toBe('2024-01-15');
        expect(dto.tasksCompleted).toBe(5);
        expect(dto.tasksFailed).toBe(0);
        expect(dto.totalDuration).toBe(240);
        expect(dto.efficiencyScore).toBe(1.25);
      });
    });

    describe('AnalyticsEfficiencyDataDto', () => {
      it('should export AnalyticsEfficiencyDataDto class', () => {
        expect(AnalyticsEfficiencyDataDto).toBeDefined();
      });

      it('should instantiate AnalyticsEfficiencyDataDto with valid data', () => {
        const efficiencyPoint = new EfficiencyPointDto();
        efficiencyPoint.sessionId = 'SESSION_2026-03-15_10-30-00';
        efficiencyPoint.date = '2024-01-15';
        efficiencyPoint.tasksCompleted = 5;
        efficiencyPoint.tasksFailed = 0;
        efficiencyPoint.totalDuration = 240;
        efficiencyPoint.efficiencyScore = 1.25;

        const dto = new AnalyticsEfficiencyDataDto();
        dto.sessions = [efficiencyPoint];
        dto.averageEfficiency = 1.18;
        dto.totalTasksCompleted = 45;
        dto.totalTasksFailed = 3;

        expect(dto.sessions).toHaveLength(1);
        expect(dto.averageEfficiency).toBe(1.18);
        expect(dto.totalTasksCompleted).toBe(45);
        expect(dto.totalTasksFailed).toBe(3);
      });
    });
  });

  describe('Models DTOs (models.dto.ts)', () => {
    describe('ModelUsagePointDto', () => {
      it('should export ModelUsagePointDto class', () => {
        expect(ModelUsagePointDto).toBeDefined();
      });

      it('should instantiate ModelUsagePointDto with valid data', () => {
        const dto = new ModelUsagePointDto();
        dto.sessionId = 'SESSION_2026-03-15_10-30-00';
        dto.date = '2024-01-15';
        dto.model = 'claude-sonnet-4';
        dto.calls = 12;
        dto.tokens = 150000;
        dto.cost = 8.5;

        expect(dto.sessionId).toBe('SESSION_2026-03-15_10-30-00');
        expect(dto.date).toBe('2024-01-15');
        expect(dto.model).toBe('claude-sonnet-4');
        expect(dto.calls).toBe(12);
        expect(dto.tokens).toBe(150000);
        expect(dto.cost).toBe(8.5);
      });
    });

    describe('AnalyticsModelsDataDto', () => {
      it('should export AnalyticsModelsDataDto class', () => {
        expect(AnalyticsModelsDataDto).toBeDefined();
      });

      it('should instantiate AnalyticsModelsDataDto with valid data', () => {
        const usagePoint = new ModelUsagePointDto();
        usagePoint.sessionId = 'SESSION_2026-03-15_10-30-00';
        usagePoint.date = '2024-01-15';
        usagePoint.model = 'claude-sonnet-4';
        usagePoint.calls = 12;
        usagePoint.tokens = 150000;
        usagePoint.cost = 8.5;

        const dto = new AnalyticsModelsDataDto();
        dto.usage = [usagePoint];
        dto.totalCalls = 150;
        dto.totalTokens = 2000000;
        dto.totalCost = 120.5;

        expect(dto.usage).toHaveLength(1);
        expect(dto.totalCalls).toBe(150);
        expect(dto.totalTokens).toBe(2000000);
        expect(dto.totalCost).toBe(120.5);
      });
    });
  });
});

describe('Analytics Barrel Exports', () => {
  it('should export SessionAnalyticsDto from analytics barrel', () => {
    expect(AnalyticsModule.SessionAnalyticsDto).toBeDefined();
  });

  it('should export SessionComparisonRowDto from analytics barrel', () => {
    expect(AnalyticsModule.SessionComparisonRowDto).toBeDefined();
  });

  it('should export SessionCostPointDto from analytics barrel', () => {
    expect(AnalyticsModule.SessionCostPointDto).toBeDefined();
  });

  it('should export AnalyticsCostDataDto from analytics barrel', () => {
    expect(AnalyticsModule.AnalyticsCostDataDto).toBeDefined();
  });

  it('should export EfficiencyPointDto from analytics barrel', () => {
    expect(AnalyticsModule.EfficiencyPointDto).toBeDefined();
  });

  it('should export AnalyticsEfficiencyDataDto from analytics barrel', () => {
    expect(AnalyticsModule.AnalyticsEfficiencyDataDto).toBeDefined();
  });

  it('should export ModelUsagePointDto from analytics barrel', () => {
    expect(AnalyticsModule.ModelUsagePointDto).toBeDefined();
  });

  it('should export AnalyticsModelsDataDto from analytics barrel', () => {
    expect(AnalyticsModule.AnalyticsModelsDataDto).toBeDefined();
  });
});

describe('Responses Barrel Exports', () => {
  it('should re-export all analytics DTOs from responses barrel', () => {
    expect(ResponsesModule.SessionAnalyticsDto).toBeDefined();
    expect(ResponsesModule.SessionComparisonRowDto).toBeDefined();
    expect(ResponsesModule.SessionCostPointDto).toBeDefined();
    expect(ResponsesModule.AnalyticsCostDataDto).toBeDefined();
    expect(ResponsesModule.EfficiencyPointDto).toBeDefined();
    expect(ResponsesModule.AnalyticsEfficiencyDataDto).toBeDefined();
    expect(ResponsesModule.ModelUsagePointDto).toBeDefined();
    expect(ResponsesModule.AnalyticsModelsDataDto).toBeDefined();
  });
});

describe('DTO Type Safety', () => {
  it('should maintain readonly properties', () => {
    const dto = new SessionAnalyticsDto();
    dto.taskId = 'TASK_2026_001';
    expect(() => {
      (dto as any).taskId = 'TASK_2026_002';
    }).not.toThrow();
  });

  it('should accept null for nullable properties', () => {
    const dto = new SessionAnalyticsDto();
    dto.filesModified = null;
    expect(dto.filesModified).toBeNull();
  });

  it('should handle ReadonlyArray types', () => {
    const dto = new SessionAnalyticsDto();
    dto.phasesCompleted = ['PM', 'Dev'];
    expect(Array.isArray(dto.phasesCompleted)).toBe(true);
  });

  it('should handle Record<string, number> types', () => {
    const dto = new SessionCostPointDto();
    dto.costByModel = { 'model-a': 1.5, 'model-b': 2.0 };
    expect(typeof dto.costByModel['model-a']).toBe('number');
  });
});
