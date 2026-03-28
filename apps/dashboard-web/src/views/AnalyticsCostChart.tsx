import React from 'react';
import { tokens } from '../theme/tokens.js';
import type { SessionCostPoint } from '../types/index.js';

interface Props {
  readonly sessions: ReadonlyArray<SessionCostPoint>;
}

const LEGEND_ITEMS = [
  { color: tokens.colors.blue, label: 'Other' },
  { color: tokens.colors.cyan, label: 'Sonnet' },
  { color: tokens.colors.purple, label: 'Opus' },
] as const;

const BAR_W = 600;
const BAR_H = 180;
const PAD = { top: 10, right: 10, bottom: 40, left: 50 };
const CHART_W = BAR_W - PAD.left - PAD.right;
const CHART_H = BAR_H - PAD.top - PAD.bottom;

export function AnalyticsCostChart({ sessions }: Props): React.JSX.Element {
  if (sessions.length < 2) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: tokens.colors.textDim, fontSize: '13px' }}>
        Not enough data (need ≥ 2 sessions)
      </div>
    );
  }

  const maxCost = Math.max(...sessions.map((s) => s.totalCost), 0.01);
  const barWidth = (CHART_W / sessions.length) * 0.7;
  const gap = CHART_W / sessions.length;

  return (
    <>
    <svg
      width="100%"
      viewBox={`0 0 ${BAR_W} ${BAR_H}`}
      style={{ display: 'block' }}
      aria-label="Cost per session bar chart"
    >
      {/* Y-axis label */}
      <text
        x={12}
        y={BAR_H / 2}
        textAnchor="middle"
        fontSize="10"
        fill={tokens.colors.textDim}
        transform={`rotate(-90, 12, ${BAR_H / 2})`}
      >
        Cost ($)
      </text>

      {/* Y-axis ticks */}
      {[0, 0.5, 1].map((ratio) => {
        const y = PAD.top + CHART_H - ratio * CHART_H;
        const label = (maxCost * ratio).toFixed(2);
        return (
          <g key={ratio}>
            <line x1={PAD.left - 4} y1={y} x2={PAD.left} y2={y} stroke={tokens.colors.border} strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill={tokens.colors.textDim}>
              ${label}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {sessions.map((s, i) => {
        const barH = (s.totalCost / maxCost) * CHART_H;
        const x = PAD.left + i * gap + (gap - barWidth) / 2;
        const y = PAD.top + CHART_H - barH;

        const opusCost = s.costByModel['claude-opus-4-6'] ?? 0;
        const sonnetCost = s.costByModel['claude-sonnet-4-6'] ?? 0;
        const hasBreakdown = opusCost > 0 || sonnetCost > 0;

        if (hasBreakdown && s.totalCost > 0) {
          const opusH = (opusCost / maxCost) * CHART_H;
          const sonnetH = (sonnetCost / maxCost) * CHART_H;
          const otherH = barH - opusH - sonnetH;

          return (
            <g key={s.sessionId}>
              {otherH > 0 && (
                <rect x={x} y={y} width={barWidth} height={otherH} fill={tokens.colors.blue} rx="2" />
              )}
              {sonnetH > 0 && (
                <rect x={x} y={y + otherH} width={barWidth} height={sonnetH} fill={tokens.colors.cyan} rx="1" />
              )}
              {opusH > 0 && (
                <rect x={x} y={y + otherH + sonnetH} width={barWidth} height={opusH} fill={tokens.colors.purple} rx="1" />
              )}
              <text
                x={x + barWidth / 2}
                y={BAR_H - PAD.bottom + 14}
                textAnchor="middle"
                fontSize="9"
                fill={tokens.colors.textDim}
              >
                {s.date.slice(5)}
              </text>
            </g>
          );
        }

        return (
          <g key={s.sessionId}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, 1)} fill={tokens.colors.blue} rx="2" />
            <text
              x={x + barWidth / 2}
              y={BAR_H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize="9"
              fill={tokens.colors.textDim}
            >
              {s.date.slice(5)}
            </text>
          </g>
        );
      })}

      {/* Axis baseline */}
      <line
        x1={PAD.left}
        y1={PAD.top + CHART_H}
        x2={BAR_W - PAD.right}
        y2={PAD.top + CHART_H}
        stroke={tokens.colors.border}
        strokeWidth="1"
      />
    </svg>

    {/* Color legend */}
    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11px', color: tokens.colors.textDim }}>
      {LEGEND_ITEMS.map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: color, flexShrink: 0 }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
    </>
  );
}
