import React from 'react';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';
import { TaskCard } from '../components/TaskCard.js';
import type { TaskStatus } from '../types/index.js';

const COLUMNS: readonly TaskStatus[] = [
  'CREATED',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'IN_REVIEW',
  'COMPLETE',
  'BLOCKED',
  'FAILED',
  'CANCELLED',
];

export function TaskBoard(): React.JSX.Element {
  const registry = useDashboardStore((s) => s.registry);
  const isLoading = useDashboardStore((s) => s.isLoading);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim }}>Loading...</div>;
  }

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
        Task Board
      </h1>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {COLUMNS.map((status) => {
          const tasks = registry.filter((t) => t.status === status);
          return (
            <div
              key={status}
              style={{
                minWidth: '280px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: tokens.colors.bgCard,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: `${tokens.radius.sm} ${tokens.radius.sm} 0 0`,
                  borderBottom: 'none',
                  marginBottom: 0,
                  fontWeight: 700,
                  fontSize: '14px',
                  color: tokens.colors.textBright,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{status.replace('_', ' ')}</span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    backgroundColor:
                      tokens.stateColors[status]?.dim ?? tokens.colors.redDim,
                    color: tokens.stateColors[status]?.bg ?? tokens.colors.red,
                  }}
                >
                  {tasks.length}
                </span>
              </div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: tokens.colors.bgCard,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: `0 0 ${tokens.radius.sm} ${tokens.radius.sm}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minHeight: '200px',
                }}
              >
                {tasks.length === 0 ? (
                  <div
                    style={{
                      color: tokens.colors.textDim,
                      fontSize: '13px',
                      textAlign: 'center',
                      padding: '20px',
                    }}
                  >
                    No tasks
                  </div>
                ) : (
                  tasks.map((task) => <TaskCard key={task.id} task={task} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
