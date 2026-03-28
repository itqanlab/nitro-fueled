import React from 'react';
import { tokens } from '../theme/tokens.js';
import type { AnalyticsModelsData } from '../types/index.js';

interface Props {
  readonly data: AnalyticsModelsData;
}

// Track background: textDim at 15% opacity (muted neutral fill for bar backgrounds)
const TRACK_BG = 'rgba(148,163,184,0.15)';
// Savings box background: green at 8% opacity
const SAVINGS_BG = tokens.colors.greenDim;

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-6': tokens.colors.purple,
  'claude-sonnet-4-6': tokens.colors.cyan,
  'claude-haiku-4-6': tokens.colors.green,
};

function modelColor(model: string): string {
  return MODEL_COLORS[model] ?? tokens.colors.blue;
}

function formatModel(model: string): string {
  return model.replace('claude-', '').replace(/-/g, ' ');
}

export function AnalyticsModelsChart({ data }: Props): React.JSX.Element {
  const { models, totalCost, hypotheticalOpusCost, actualSavings } = data;

  const maxCost = Math.max(...models.map((m) => m.totalCost), 0.01);

  return (
    <div>
      {models.length === 0 ? (
        <div style={{ padding: '16px', color: tokens.colors.textDim, fontSize: '13px' }}>
          No model usage data available yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {models.map((m) => {
            const pct = maxCost > 0 ? (m.totalCost / maxCost) * 100 : 0;
            const color = modelColor(m.model);
            return (
              <div key={m.model}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: tokens.colors.text, textTransform: 'capitalize' }}>
                    {formatModel(m.model)}
                  </span>
                  <span style={{ color: tokens.colors.textDim, fontWeight: 600 }}>
                    ${m.totalCost.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    height: '8px',
                    backgroundColor: TRACK_BG,
                    borderRadius: '999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      backgroundColor: color,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(totalCost > 0 || hypotheticalOpusCost > 0) && (
        <div
          style={{
            marginTop: '20px',
            padding: '12px 16px',
            backgroundColor: SAVINGS_BG,
            border: `1px solid ${tokens.colors.green}`,
            borderRadius: tokens.radius.sm,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '12px', color: tokens.colors.textDim }}>
            Actual cost: <span style={{ color: tokens.colors.text }}>${totalCost.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textDim }}>
            If all Opus: <span style={{ color: tokens.colors.text }}>${hypotheticalOpusCost.toFixed(2)}</span>
          </div>
          {actualSavings > 0 && (
            <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.green }}>
              Estimated savings: ${actualSavings.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
