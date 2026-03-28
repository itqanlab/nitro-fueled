import React from 'react';
import { tokens } from '../theme/tokens.js';
import type { ActiveWorker } from '../types/index.js';
import { formatDistanceToNow } from 'date-fns';

interface WorkerCardProps {
  readonly worker: ActiveWorker;
}

function safeFormatDistance(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return 'unknown';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'unknown';
  }
}

export function WorkerCard({ worker }: WorkerCardProps): React.JSX.Element {
  const elapsed = safeFormatDistance(worker.spawnTime);

  const isHealthy = worker.stuckCount === 0;
  const statusLabel = isHealthy ? 'Healthy' : `Stuck (${worker.stuckCount})`;

  return (
    <div
      style={{
        backgroundColor: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.md,
        padding: '16px',
        fontFamily: tokens.font.mono,
        fontSize: '13px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '12px',
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 700,
              color: tokens.colors.textBright,
              fontSize: '14px',
            }}
          >
            {worker.label}
          </div>
          <div
            style={{
              color: tokens.colors.textDim,
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
            {worker.workerId.slice(0, 12)}...
          </div>
        </div>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: isHealthy
              ? tokens.colors.greenDim
              : tokens.colors.redDim,
            color: isHealthy ? tokens.colors.green : tokens.colors.red,
          }}
        >
          {statusLabel}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          fontSize: '12px',
        }}
      >
        <div>
          <span style={{ color: tokens.colors.textDim }}>Task: </span>
          <span style={{ color: tokens.colors.text }}>{worker.taskId}</span>
        </div>
        <div>
          <span style={{ color: tokens.colors.textDim }}>Type: </span>
          <span style={{ color: tokens.colors.text }}>{worker.workerType}</span>
        </div>
        <div>
          <span style={{ color: tokens.colors.textDim }}>Elapsed: </span>
          <span style={{ color: tokens.colors.text }}>{elapsed}</span>
        </div>
        <div>
          <span style={{ color: tokens.colors.textDim }}>Last Check: </span>
          <span style={{ color: tokens.colors.text }}>
            {safeFormatDistance(worker.lastHealth)}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: `1px solid ${tokens.colors.border}`,
          fontSize: '11px',
          color: tokens.colors.textDim,
        }}
      >
        Expecting: {worker.expectedEndState}
      </div>
    </div>
  );
}
