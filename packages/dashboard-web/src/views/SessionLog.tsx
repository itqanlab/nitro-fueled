import React, { useEffect, useRef } from 'react';
import { useDashboardStore } from '../store/index.js';
import { tokens } from '../theme/tokens.js';
import { useWebSocket } from '../hooks/index.js';

export function SessionLog(): React.JSX.Element {
  const state = useDashboardStore((s) => s.state);
  const logRef = useRef<HTMLDivElement>(null);

  useWebSocket();

  const entries = state?.sessionLog ?? [];

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries]);

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
        Session Log
      </h1>

      <div
        ref={logRef}
        style={{
          backgroundColor: tokens.colors.bgCard,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.md,
          padding: '16px',
          height: 'calc(100vh - 140px)',
          overflowY: 'auto',
          fontFamily: tokens.font.mono,
          fontSize: '13px',
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              color: tokens.colors.textDim,
              textAlign: 'center',
              padding: '40px',
            }}
          >
            No log entries yet
          </div>
        ) : (
          entries.map((entry, idx) => {
            const timestamp = new Date(entry.timestamp);
            const isRecent = Date.now() - timestamp.getTime() < 60000;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '6px 0',
                  borderBottom:
                    idx < entries.length - 1
                      ? `1px solid ${tokens.colors.border}`
                      : undefined,
                  opacity: isRecent ? 1 : 0.7,
                }}
              >
                <div
                  style={{
                    color: tokens.colors.textDim,
                    fontSize: '11px',
                    minWidth: '80px',
                    flexShrink: 0,
                  }}
                >
                  {timestamp.toLocaleTimeString()}
                </div>
                <div
                  style={{
                    color: tokens.colors.text,
                    wordBreak: 'break-word',
                  }}
                >
                  {entry.event}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
