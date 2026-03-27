import React from 'react';
import { tokens } from '../theme/tokens.js';
import type { EfficiencyPoint } from '../types/index.js';

interface Props {
  readonly sessions: ReadonlyArray<EfficiencyPoint>;
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 700,
  color: tokens.colors.textDim,
  borderBottom: `1px solid ${tokens.colors.border}`,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13px',
  color: tokens.colors.text,
  borderBottom: `1px solid ${tokens.colors.border}`,
  whiteSpace: 'nowrap',
};

function formatFailureRate(rate: number): string {
  return rate > 0 ? `${(rate * 100).toFixed(1)}%` : '0%';
}

function formatScore(score: number): string {
  return score > 0 ? `${score.toFixed(1)}/10` : '—';
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function AnalyticsEfficiencyTable({ sessions }: Props): React.JSX.Element {
  if (sessions.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: tokens.colors.textDim, fontSize: '13px' }}>
        No efficiency data available yet
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Session</th>
            <th style={th}>Date</th>
            <th style={th}>Failure Rate</th>
            <th style={th}>Avg Review Score</th>
            <th style={th}>Avg Task Duration</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((row) => (
            <tr key={row.sessionId}>
              <td
                style={{ ...td, fontFamily: tokens.font.mono, fontSize: '11px', color: tokens.colors.textDim }}
              >
                {row.sessionId.replace('SESSION_', '')}
              </td>
              <td style={td}>{row.date}</td>
              <td style={{ ...td, color: row.failureRate > 0 ? tokens.colors.red : tokens.colors.textDim }}>
                {formatFailureRate(row.failureRate)}
              </td>
              <td style={{ ...td, color: tokens.colors.yellow }}>{formatScore(row.avgReviewScore)}</td>
              <td style={td}>{formatDuration(row.avgDurationMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
