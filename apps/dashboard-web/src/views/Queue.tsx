import React from 'react';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';
import { TaskCard } from '../components/TaskCard.js';

export function Queue(): React.JSX.Element {
  const state = useDashboardStore((s) => s.state);
  const registry = useDashboardStore((s) => s.registry);
  const isLoading = useDashboardStore((s) => s.isLoading);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

  const queue = state?.taskQueue ?? [];
  const hasQueue = queue.length > 0;

  const getTaskById = (id: string) => registry.find((t) => t.id === id);

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
        Task Queue
      </h1>

      {!hasQueue ? (
        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '48px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📥</div>
          <div
            style={{
              fontSize: '16px',
              color: tokens.colors.textDim,
            }}
          >
            Queue is empty
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              marginBottom: '16px',
              fontSize: '14px',
              color: tokens.colors.textDim,
            }}
          >
            {queue.length} task{queue.length !== 1 ? 's' : ''} queued
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            {queue.map((item) => {
              const task = getTaskById(item.taskId);
              if (!task) return null;

              return <TaskCard key={item.taskId} task={task} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
