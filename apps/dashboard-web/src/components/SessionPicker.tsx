import React from 'react';
import { api } from '../api/client.js';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';

export function SessionPicker(): React.JSX.Element | null {
  const sessions = useDashboardStore((s) => s.sessions);
  const selectedSessionId = useDashboardStore((s) => s.selectedSessionId);
  const setSelectedSession = useDashboardStore((s) => s.setSelectedSession);
  const setSessionData = useDashboardStore((s) => s.setSessionData);

  if (sessions.length === 0) return null;

  const activeSessions = sessions.filter((s) => s.isActive);

  const onSelect = (id: string): void => {
    setSelectedSession(id);
    // Always re-fetch on selection to ensure fresh data (avoids stale cache for active sessions).
    void api.getSession(id).then((d) => setSessionData(id, d)).catch(console.error);
  };

  const labelText =
    activeSessions.length >= 2
      ? `Sessions (${activeSessions.length} active)`
      : 'Sessions';

  return (
    <div style={{ marginTop: '24px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: tokens.colors.textDim,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '8px',
        }}
      >
        {labelText}
      </div>
      <select
        value={selectedSessionId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          width: '100%',
          backgroundColor: tokens.colors.bg,
          color: tokens.colors.text,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.sm,
          padding: '8px 10px',
          fontSize: '12px',
          fontFamily: tokens.font.mono,
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          paddingRight: '28px',
        }}
      >
        {sessions.map((session) => {
          const prefix = session.isActive ? '● ' : '○ ';
          const suffix = session.isActive ? ' (active)' : '';
          return (
            <option key={session.sessionId} value={session.sessionId}>
              {prefix}{session.sessionId}{suffix}
            </option>
          );
        })}
      </select>
    </div>
  );
}
