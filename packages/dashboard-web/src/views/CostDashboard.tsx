import React from 'react';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';
import { useStats } from '../hooks/index.js';

export function CostDashboard(): React.JSX.Element {
  const stats = useStats();
  const isLoading = useDashboardStore((s) => s.isLoading);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

  const byStatus = stats?.byStatus ?? {};
  const byType = stats?.byType ?? {};
  const completionRate = stats?.completionRate ?? 0;

  return (
    <div>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: tokens.colors.textBright,
          marginBottom: '24px',
        }}
      >
        Cost & Stats
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>
            Total Tasks
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: tokens.colors.textBright,
            }}
          >
            {stats?.totalTasks ?? 0}
          </div>
        </div>

        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>
            Completion Rate
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: tokens.colors.green,
            }}
          >
            {(completionRate * 100).toFixed(1)}%
          </div>
        </div>

        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>
            Active Workers
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: tokens.colors.yellow,
            }}
          >
            {stats?.activeWorkers ?? 0}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '20px',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: tokens.colors.textBright,
              marginBottom: '16px',
            }}
          >
            By Status
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {Object.entries(byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const maxCount = Math.max(...Object.values(byStatus));
                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const colors =
                  tokens.stateColors[status as keyof typeof tokens.stateColors];

                return (
                  <div key={status}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: tokens.colors.text }}>{status}</span>
                      <span
                        style={{
                          color: tokens.colors.textDim,
                          fontWeight: 600,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        backgroundColor: 'rgba(148,163,184,0.2)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${width}%`,
                          backgroundColor: colors?.bg ?? tokens.colors.blue,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '20px',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: tokens.colors.textBright,
              marginBottom: '16px',
            }}
          >
            By Type
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {Object.entries(byType)
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const maxCount = Math.max(...Object.values(byType));
                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const colors =
                  tokens.typeColors[type as keyof typeof tokens.typeColors];

                return (
                  <div key={type}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: tokens.colors.text }}>{type}</span>
                      <span
                        style={{
                          color: tokens.colors.textDim,
                          fontWeight: 600,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        backgroundColor: 'rgba(148,163,184,0.2)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${width}%`,
                          backgroundColor: colors?.bg ?? tokens.colors.blue,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
