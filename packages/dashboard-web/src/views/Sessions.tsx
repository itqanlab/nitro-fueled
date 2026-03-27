import React, { useEffect } from 'react';
import { api } from '../api/client.js';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';

function formatStarted(raw: string): string {
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

export function Sessions(): React.JSX.Element {
  const sessions = useDashboardStore((s) => s.sessions);
  const sessionData = useDashboardStore((s) => s.sessionData);
  const setSessionData = useDashboardStore((s) => s.setSessionData);

  // Fetch data for any sessions not yet in the cache (e.g. non-selected sessions).
  useEffect(() => {
    for (const session of sessions) {
      if (!sessionData.has(session.sessionId)) {
        void api.getSession(session.sessionId)
          .then((d) => setSessionData(session.sessionId, d))
          .catch(console.error);
      }
    }
  }, [sessions, sessionData, setSessionData]);

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
        Sessions
      </h1>

      {sessions.length === 0 ? (
        <div
          style={{
            backgroundColor: tokens.colors.bgCard,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.md,
            padding: '48px',
            textAlign: 'center',
            color: tokens.colors.textDim,
            fontSize: '15px',
          }}
        >
          No sessions recorded yet.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {sessions.map((session) => {
            const data = sessionData.get(session.sessionId);
            const workerCount = data?.state?.activeWorkers?.length ?? 0;

            return (
              <div
                key={session.sessionId}
                style={{
                  backgroundColor: tokens.colors.bgCard,
                  border: `1px solid ${session.isActive ? tokens.colors.green : tokens.colors.border}`,
                  borderRadius: tokens.radius.md,
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: tokens.colors.textBright,
                      fontFamily: tokens.font.mono,
                      wordBreak: 'break-all',
                    }}
                  >
                    {session.sessionId}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: session.isActive ? tokens.colors.green : tokens.colors.textDim,
                      flexShrink: 0,
                      marginLeft: '8px',
                    }}
                  >
                    {session.isActive ? '● ACTIVE' : '○ historical'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: tokens.colors.textDim }}>Loop Status</span>
                    <span style={{ color: tokens.colors.text, fontFamily: tokens.font.mono }}>
                      {session.loopStatus}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: tokens.colors.textDim }}>Started</span>
                    <span style={{ color: tokens.colors.text, fontFamily: tokens.font.mono }}>
                      {formatStarted(session.started)}
                    </span>
                  </div>

                  {session.isActive ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: tokens.colors.textDim }}>Active Workers</span>
                      <span
                        style={{
                          color: workerCount > 0 ? tokens.colors.green : tokens.colors.textDim,
                          fontFamily: tokens.font.mono,
                          fontWeight: 600,
                        }}
                      >
                        {workerCount}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: tokens.colors.textDim }}>Tasks</span>
                      <span style={{ color: tokens.colors.text, fontFamily: tokens.font.mono }}>
                        {session.taskCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
