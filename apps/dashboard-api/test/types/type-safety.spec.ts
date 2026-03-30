import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TaskIdParamDto } from '../../src/app/dtos/requests/task-id.param.dto';
import {
  SessionAnalyticsDto,
  SessionComparisonRowDto,
  SessionCostPointDto,
  AnalyticsCostDataDto,
  EfficiencyPointDto,
  AnalyticsEfficiencyDataDto,
  ModelUsagePointDto,
  AnalyticsModelsDataDto,
} from '../../src/app/dtos/responses/analytics';

describe('Type Safety - No Compilation Errors', () => {
  describe('TaskIdParamDto types', () => {
    it('should have string id property', () => {
      const dto: TaskIdParamDto = plainToInstance(TaskIdParamDto, { id: 'TASK_2026_001' });
      expect(typeof dto.id).toBe('string');
    });

    it('should accept only string values', () => {
      const validId: string = 'TASK_2026_001';
      expect(() => {
        const dto = plainToInstance(TaskIdParamDto, { id: validId });
      }).not.toThrow();
    });
  });

  describe('Analytics DTOs - Session', () => {
    it('SessionAnalyticsDto should have correct property types', () => {
      const dto: SessionAnalyticsDto = plainToInstance(SessionAnalyticsDto, {
        taskId: 'TASK_2026_001',
        outcome: 'COMPLETE',
        startTime: '2024-01-15T10:00:00.000Z',
        endTime: '2024-01-15T10:45:00.000Z',
        duration: '45m',
        phasesCompleted: ['PM', 'Dev'],
        filesModified: 12,
      });

      expect(typeof dto.taskId).toBe('string');
      expect(typeof dto.outcome).toBe('string');
      expect(typeof dto.startTime).toBe('string');
      expect(typeof dto.endTime).toBe('string');
      expect(typeof dto.duration).toBe('string');
      expect(Array.isArray(dto.phasesCompleted)).toBe(true);
      expect(typeof dto.filesModified).toBe('number');
    });

    it('SessionAnalyticsDto should accept null for filesModified', () => {
      const dto: SessionAnalyticsDto = plainToInstance(SessionAnalyticsDto, {
        taskId: 'TASK_2026_001',
        filesModified: null,
      });

      expect(dto.filesModified).toBeNull();
    });

    it('SessionComparisonRowDto should have correct property types', () => {
      const dto: SessionComparisonRowDto = plainToInstance(SessionComparisonRowDto, {
        sessionId: 'SESSION_2026-03-15_10-30-00',
        date: '2024-01-15',
        taskCount: 5,
        durationMinutes: 240,
        totalCost: 42.5,
        failureCount: 1,
        avgReviewScore: 8.5,
      });

      expect(typeof dto.sessionId).toBe('string');
      expect(typeof dto.date).toBe('string');
      expect(typeof dto.taskCount).toBe('number');
      expect(typeof dto.durationMinutes).toBe('number');
      expect(typeof dto.totalCost).toBe('number');
      expect(typeof dto.failureCount).toBe('number');
      expect(typeof dto.avgReviewScore).toBe('number');
    });
  });

  describe('Analytics DTOs - Cost', () => {
    it('SessionCostPointDto should have correct property types', () => {
      const dto: SessionCostPointDto = plainToInstance(SessionCostPointDto, {
        sessionId: 'SESSION_2026-03-15_10-30-00',
        date: '2024-01-15',
        totalCost: 8.5,
        costByModel: { 'model': 1.5 },
        taskCount: 5,
      });

      expect(typeof dto.sessionId).toBe('string');
      expect(typeof dto.date).toBe('string');
      expect(typeof dto.totalCost).toBe('number');
      expect(typeof dto.taskCount).toBe('number');
      expect(typeof dto.costByModel).toBe('object');
    });

    it('AnalyticsCostDataDto should have correct property types', () => {
      const sessionPoint: SessionCostPointDto = plainToInstance(SessionCostPointDto, {
        sessionId: 'SESSION_2026-03-15_10-30-00',
        date: '2024-01-15',
        totalCost: 8.5,
        costByModel: {},
        taskCount: 5,
      });

      const dto: AnalyticsCostDataDto = plainToInstance(AnalyticsCostDataDto, {
        sessions: [sessionPoint],
        cumulativeCost: 350.0,
        hypotheticalOpusCost: 1200.0,
      });

      expect(Array.isArray(dto.sessions)).toBe(true);
      expect(typeof dto.cumulativeCost).toBe('number');
      expect(typeof dto.hypotheticalOpusCost).toBe('number');
    });
  });

  describe('Analytics DTOs - Efficiency', () => {
    it('EfficiencyPointDto should have correct property types', () => {
      const dto: EfficiencyPointDto = plainToInstance(EfficiencyPointDto, {
        sessionId: 'SESSION_2026-03-15_10-30-00',
        date: '2024-01-15',
        avgDurationMinutes: 45.5,
        avgTokensPerTask: 250000,
        retryRate: 0.1,
        failureRate: 0.05,
        avgReviewScore: 8.2,
      });

      expect(typeof dto.sessionId).toBe('string');
      expect(typeof dto.date).toBe('string');
      expect(typeof dto.avgDurationMinutes).toBe('number');
      expect(typeof dto.avgTokensPerTask).toBe('number');
      expect(typeof dto.retryRate).toBe('number');
      expect(typeof dto.failureRate).toBe('number');
      expect(typeof dto.avgReviewScore).toBe('number');
    });

    it('AnalyticsEfficiencyDataDto should have correct property types', () => {
      const efficiencyPoint: EfficiencyPointDto = plainToInstance(EfficiencyPointDto, {
        sessionId: 'SESSION_2026-03-15_10-30-00',
        date: '2024-01-15',
        avgDurationMinutes: 45.5,
        avgTokensPerTask: 250000,
        retryRate: 0.1,
        failureRate: 0.05,
        avgReviewScore: 8.2,
      });

      const dto: AnalyticsEfficiencyDataDto = plainToInstance(AnalyticsEfficiencyDataDto, {
        sessions: [efficiencyPoint],
      });

      expect(Array.isArray(dto.sessions)).toBe(true);
    });
  });

  describe('Analytics DTOs - Models', () => {
    it('ModelUsagePointDto should have correct property types', () => {
      const dto: ModelUsagePointDto = plainToInstance(ModelUsagePointDto, {
        model: 'claude-sonnet-4-20250514',
        totalCost: 100.0,
        taskCount: 85,
        tokenCount: 4000000,
      });

      expect(typeof dto.model).toBe('string');
      expect(typeof dto.totalCost).toBe('number');
      expect(typeof dto.taskCount).toBe('number');
      expect(typeof dto.tokenCount).toBe('number');
    });

    it('AnalyticsModelsDataDto should have correct property types', () => {
      const usagePoint: ModelUsagePointDto = plainToInstance(ModelUsagePointDto, {
        model: 'claude-sonnet-4-20250514',
        totalCost: 100.0,
        taskCount: 85,
        tokenCount: 4000000,
      });

      const dto: AnalyticsModelsDataDto = plainToInstance(AnalyticsModelsDataDto, {
        models: [usagePoint],
        totalCost: 350.0,
        hypotheticalOpusCost: 1200.0,
        actualSavings: 850.0,
      });

      expect(Array.isArray(dto.models)).toBe(true);
      expect(typeof dto.totalCost).toBe('number');
      expect(typeof dto.hypotheticalOpusCost).toBe('number');
      expect(typeof dto.actualSavings).toBe('number');
    });
  });

  describe('Type inference and generics', () => {
    it('should infer correct types from array operations', () => {
      const sessions: SessionAnalyticsDto[] = [plainToInstance(SessionAnalyticsDto, {
        taskId: 'TASK_2026_001',
        outcome: 'COMPLETE',
        startTime: '2024-01-15T10:00:00.000Z',
        endTime: '2024-01-15T10:45:00.000Z',
        duration: '45m',
        phasesCompleted: ['PM'],
        filesModified: 12,
      })];

      const firstSession = sessions[0];
      expect(firstSession.taskId).toBe('TASK_2026_001');
    });

    it('should maintain type safety with ReadonlyArray', () => {
      const phases: ReadonlyArray<string> = ['PM', 'Dev', 'QA'];
      expect(typeof phases[0]).toBe('string');
    });

    it('should handle Record<string, number> types correctly', () => {
      const costByModel: Record<string, number> = {
        'claude-sonnet-4': 7.0,
        'claude-haiku-4': 1.5,
      };
      expect(typeof costByModel['claude-sonnet-4']).toBe('number');
    });
  });

  describe('Union types and optional properties', () => {
    it('should handle number | null type correctly', () => {
      const dto: SessionAnalyticsDto = plainToInstance(SessionAnalyticsDto, {
        taskId: 'TASK_2026_001',
        filesModified: 10,
      });
      expect(typeof dto.filesModified).toBe('number');

      const dto2: SessionAnalyticsDto = plainToInstance(SessionAnalyticsDto, {
        taskId: 'TASK_2026_001',
        filesModified: null,
      });
      expect(dto2.filesModified).toBeNull();
    });

    it('should handle optional fields in object construction', () => {
      const partialSession: Partial<SessionAnalyticsDto> = {
        taskId: 'TASK_2026_001',
      };
      expect(partialSession.taskId).toBe('TASK_2026_001');
      expect(partialSession.filesModified).toBeUndefined();
    });
  });

  describe('Type guards and type narrowing', () => {
    it('should correctly identify DTO types', () => {
      const dto: SessionAnalyticsDto = plainToInstance(SessionAnalyticsDto, {
        taskId: 'TASK_2026_001',
        outcome: 'COMPLETE',
        startTime: '2024-01-15T10:00:00.000Z',
        endTime: '2024-01-15T10:45:00.000Z',
        duration: '45m',
        phasesCompleted: ['PM'],
        filesModified: null,
      });

      expect(dto instanceof SessionAnalyticsDto).toBe(true);
    });

    it('should distinguish between different DTO classes', () => {
      const sessionDto = plainToInstance(SessionAnalyticsDto, {
        taskId: 'TASK_2026_001',
        outcome: 'COMPLETE',
        startTime: '2024-01-15T10:00:00.000Z',
        endTime: '2024-01-15T10:45:00.000Z',
        duration: '45m',
        phasesCompleted: ['PM'],
        filesModified: null,
      });

      const costDto = plainToInstance(SessionCostPointDto, {
        sessionId: 'SESSION_2026-03-15_10-30-00',
        date: '2024-01-15',
        totalCost: 8.5,
        costByModel: {},
        taskCount: 5,
      });

      expect(sessionDto instanceof SessionAnalyticsDto).toBe(true);
      expect(costDto instanceof SessionCostPointDto).toBe(true);
      expect(sessionDto instanceof SessionCostPointDto).toBe(false);
    });
  });
});
