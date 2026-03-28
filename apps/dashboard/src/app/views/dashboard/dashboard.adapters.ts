import { Task } from '../../models/task.model';
import { AnalyticsSummary } from '../../models/analytics-summary.model';
import type { TaskRecord, DashboardStats } from '../../../../dashboard-api/src/dashboard/dashboard.types';

export const ACTIVE_STATUSES = [
  'IN_PROGRESS',
  'CREATED',
  'IMPLEMENTED',
  'IN_REVIEW',
  'FIXING',
] as const;

export const COMPLETED_STATUSES = ['COMPLETE', 'CANCELLED'] as const;

export function taskRecordToTask(r: TaskRecord): Task {
  const isActive = (ACTIVE_STATUSES as readonly string[]).includes(r.status);
  return {
    id: r.id,
    title: r.description,
    status: isActive ? 'running' : 'completed',
    type: r.type === 'REFACTORING' ? 'REFACTOR' : (r.type as Task['type']),
    priority: 'medium',
    autoRun: false,
    agentLabel: r.model,
    elapsedMinutes: 0,
    cost: 0,
    progressPercent: isActive ? 50 : 100,
    tokensUsed: 'N/A',
    completedAgo: '',
    pipeline: [],
  };
}

export function statsToAnalyticsSummary(stats: DashboardStats): AnalyticsSummary {
  const active = stats.byStatus['IN_PROGRESS'] ?? 0;
  const complete = stats.byStatus['COMPLETE'] ?? 0;
  const tokensM = (stats.totalTokens / 1_000_000).toFixed(1);
  return {
    activeTasks: active,
    activeBreakdown: `${active} running`,
    completedTasks: complete,
    completedPeriod: 'all time',
    budgetUsed: parseFloat(stats.totalCost.toFixed(2)),
    budgetTotal: 100,
    budgetAlertPercent: 80,
    tokensUsed: `${tokensM}M`,
    tokensPeriod: 'all time',
    totalCost: stats.totalCost,
    clientCost: stats.totalCost,
    internalCost: 0,
  };
}
