import React from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '../theme/tokens.js';
import { StatusBadge } from './StatusBadge.js';
import type { TaskRecord } from '../types/index.js';

interface TaskCardProps {
  readonly task: TaskRecord;
}

export function TaskCard({ task }: TaskCardProps): React.JSX.Element {
  return (
    <Link
      to={`/task/${task.id}`}
      style={{
        textDecoration: 'none',
        display: 'block',
      }}
    >
      <div
        style={{
          backgroundColor: tokens.colors.bgCard,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.sm,
          padding: '14px',
          transition: 'all 0.15s ease',
          cursor: 'pointer',
          fontFamily: tokens.font.mono,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = tokens.colors.borderAccent;
          e.currentTarget.style.backgroundColor = tokens.colors.bgCardHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = tokens.colors.border;
          e.currentTarget.style.backgroundColor = tokens.colors.bgCard;
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '8px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                color: tokens.colors.textBright,
                fontSize: '13px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.id}
            </div>
          </div>
          <StatusBadge status={task.status} />
        </div>

        <div
          style={{
            fontSize: '12px',
            color: tokens.colors.textDim,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.description}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '10px',
            fontSize: '11px',
            color: tokens.colors.textDim,
          }}
        >
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: tokens.typeColors[
                task.type as keyof typeof tokens.typeColors
              ]?.dim ?? tokens.colors.blueDim,
              color:
                tokens.typeColors[
                  task.type as keyof typeof tokens.typeColors
                ]?.bg ?? tokens.colors.blue,
            }}
          >
            {task.type}
          </span>
          <span>
            {new Date(task.created).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}
