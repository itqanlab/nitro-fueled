import React from 'react';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';
import { WorkerCard } from '../components/WorkerCard.js';
import type { ActiveWorker } from '../types/index.js';

export function Workers(): React.JSX.Element {
  const state = useDashboardStore((s) => s.state);
  const isLoading = useDashboardStore((s) => s.isLoading);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

  const workers = state?.activeWorkers ?? [];
  const hasWorkers = workers.length > 0;

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
        Live Workers
      </h1>

      {state?.configuration && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.sm,
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>
              Loop Status
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color:
                  state.loopStatus === 'running'
                    ? tokens.colors.green
                    : tokens.colors.yellow,
              }}
            >
              {state.loopStatus}
            </div>
          </div>

          <div
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.sm,
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>
              Concurrency Limit
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: tokens.colors.textBright,
              }}
            >
              {state.configuration.concurrencyLimit}
            </div>
          </div>

          <div
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.sm,
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>
              Monitoring Interval
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: tokens.colors.textBright,
              }}
            >
              {state.configuration.monitoringInterval}
            </div>
          </div>

          <div
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.sm,
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>
              Retry Limit
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: tokens.colors.textBright,
              }}
            >
              {state.configuration.retryLimit}
            </div>
          </div>

          <div
            style={{
              backgroundColor: tokens.colors.bgCard,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.sm,
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>
              Compaction Count
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: tokens.colors.textBright,
              }}
            >
              {state.compactionCount}
            </div>
          </div>
        </div>
      )}

      {!hasWorkers ? (
        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '48px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            🚫
          </div>
          <div
            style={{
              fontSize: '16px',
              color: tokens.colors.textDim,
            }}
          >
            No active workers
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {workers.map((worker: ActiveWorker) => (
            <WorkerCard key={worker.workerId} worker={worker} />
          ))}
        </div>
      )}
    </div>
  );
}
