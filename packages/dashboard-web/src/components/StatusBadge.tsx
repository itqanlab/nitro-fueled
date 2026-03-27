import React from 'react';
import { tokens } from '../theme/tokens.js';
import type { TaskStatus } from '../types/index.js';

interface StatusBadgeProps {
  readonly status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  const colors = tokens.stateColors[status] ?? tokens.stateColors.BLOCKED;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        backgroundColor: colors.dim,
        color: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
