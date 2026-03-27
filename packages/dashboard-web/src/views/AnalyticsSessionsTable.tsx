import React from 'react';
import { tokens } from '../theme/tokens.js';
import type { SessionComparisonRow } from '../types/index.js';

type SortKey = keyof SessionComparisonRow;
type SortDir = 'asc' | 'desc';

interface Props {
  readonly sessions: ReadonlyArray<SessionComparisonRow>;
}

const COLUMNS: ReadonlyArray<{ readonly key: SortKey; readonly label: string }> = [
  { key: 'sessionId', label: 'Session' },
  { key: 'date', label: 'Date' },
  { key: 'taskCount', label: 'Tasks' },
  { key: 'durationMinutes', label: 'Duration' },
  { key: 'totalCost', label: 'Cost' },
  { key: 'failureCount', label: 'Failures' },
  { key: 'avgReviewScore', label: 'Avg Score' },
];

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatScore(score: number): string {
  return score > 0 ? `${score.toFixed(1)}/10` : '—';
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 700,
  color: tokens.colors.textDim,
  borderBottom: `1px solid ${tokens.colors.border}`,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13px',
  color: tokens.colors.text,
  borderBottom: `1px solid ${tokens.colors.border}`,
  whiteSpace: 'nowrap',
};

export function AnalyticsSessionsTable({ sessions }: Props): React.JSX.Element {
  const [sortKey, setSortKey] = React.useState<SortKey>('date');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');

  if (sessions.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: tokens.colors.textDim, fontSize: '13px' }}>
        No session data available yet
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    const aStr = String(av);
    const bStr = String(bv);
    return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  function handleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} style={th} onClick={() => handleSort(col.key)}>
                {col.label}{sortIndicator(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.sessionId}>
              <td style={{ ...td, fontFamily: tokens.font.mono, fontSize: '11px', color: tokens.colors.textDim }}>
                {row.sessionId.replace('SESSION_', '')}
              </td>
              <td style={td}>{row.date}</td>
              <td style={{ ...td, color: tokens.colors.blue }}>{row.taskCount}</td>
              <td style={td}>{formatDuration(row.durationMinutes)}</td>
              <td style={{ ...td, color: tokens.colors.green }}>${row.totalCost.toFixed(2)}</td>
              <td style={{ ...td, color: row.failureCount > 0 ? tokens.colors.red : tokens.colors.textDim }}>
                {row.failureCount}
              </td>
              <td style={{ ...td, color: tokens.colors.yellow }}>{formatScore(row.avgReviewScore)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
