import React from 'react';
import { tokens } from '../theme/tokens.js';

interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly color: string;
}

export function StatCard({ label, value, color }: StatCardProps): React.JSX.Element {
  return (
    <div
      style={{
        backgroundColor: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.md,
        padding: '20px',
      }}
    >
      <div style={{ fontSize: '12px', color: tokens.colors.textDim, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

export function SectionCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        backgroundColor: tokens.colors.bgCard,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.md,
        padding: '20px',
        marginBottom: '24px',
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
        {title}
      </h3>
      {children}
    </div>
  );
}
