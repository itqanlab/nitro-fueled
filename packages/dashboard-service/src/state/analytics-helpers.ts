import type { SessionCostPoint, EfficiencyPoint, SessionComparisonRow } from '../events/event-types.js';

export interface ParsedSessionCost {
  readonly totalCost: number;
  readonly costByModel: Record<string, number>;
  readonly taskCount: number;
  readonly durationMinutes: number;
  readonly failureCount: number;
}

export function parseCostFromContent(content: string): ParsedSessionCost {
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

export function parseSessionIdDate(sessionId: string): string {
  const m = sessionId.match(/SESSION_(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : sessionId;
}

export function parseAvgReviewScore(analyticsContent: string | null): number {
  if (!analyticsContent) return 0;
  let sum = 0;
  let count = 0;
  for (const m of analyticsContent.matchAll(/(\d+(?:\.\d+)?)\/10/g)) {
    sum += parseFloat(m[1]);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

export function buildSessionCostPoint(
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

export function buildEfficiencyPoint(
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

export function buildComparisonRow(
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
