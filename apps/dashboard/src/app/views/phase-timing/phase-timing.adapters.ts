import type { CortexPhaseTiming } from '../../../../../dashboard-api/src/dashboard/cortex.types';

export interface PhaseTimingRow {
  phase: string;
  phaseLabel: string;
  count: number;
  avgMin: number | null;
  minMin: number | null;
  maxMin: number | null;
  barHeightPercent: number;
  outlierThreshold: number;
  rangeWidth: string;
}

export const FALLBACK_PHASE_TIMING_ROWS: PhaseTimingRow[] = [];

const PHASE_LABELS: Record<string, string> = {
  pm: 'PM Planning',
  architect: 'Architecture',
  dev: 'Development',
  qa: 'QA Review',
  frontend: 'Frontend',
  backend: 'Backend',
  review: 'Review',
  fix: 'Fix Cycle',
  test: 'Testing',
};

function toPhaseLabel(phase: string): string {
  if (PHASE_LABELS[phase] !== undefined) return PHASE_LABELS[phase];
  return phase.charAt(0).toUpperCase() + phase.slice(1).replace(/_/g, ' ');
}

export function adaptPhaseTiming(raw: CortexPhaseTiming[] | null): PhaseTimingRow[] {
  if (!raw) return FALLBACK_PHASE_TIMING_ROWS;

  // Use the same field (max_duration_minutes) for both the denominator and numerator
  // so that rangeWidth is always in [0%, 100%] and never overflows its container.
  const maxValues = raw.map(r => r.max_duration_minutes ?? 0);
  const globalMax = maxValues.length ? Math.max(...maxValues) : 0;

  // Bar height is relative to avg values for visual comparison of typical durations.
  const avgValues = raw.map(r => r.avg_duration_minutes ?? 0);
  const globalAvgMax = avgValues.length ? Math.max(...avgValues) : 0;

  return raw.map((item): PhaseTimingRow => {
    const avgMin = item.avg_duration_minutes;
    const minMin = item.min_duration_minutes;
    const maxMin = item.max_duration_minutes;
    const avgVal = avgMin ?? 0;
    const minVal = minMin ?? 0;
    const maxVal = maxMin ?? 0;

    const barHeightPercent = globalAvgMax > 0 ? (avgVal / globalAvgMax) * 100 : 0;
    const outlierThreshold = avgVal * 3;
    // Both numerator and denominator use max_duration_minutes — guaranteed <= 100%.
    const rangeWidth =
      globalMax > 0
        ? ((maxVal - minVal) / globalMax * 100).toFixed(1) + '%'
        : '0%';

    return {
      phase: item.phase,
      phaseLabel: toPhaseLabel(item.phase),
      count: item.count,
      avgMin,
      minMin,
      maxMin,
      barHeightPercent,
      outlierThreshold,
      rangeWidth,
    };
  });
}
